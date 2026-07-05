#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, IntoVal, Vec, BytesN, token};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Created,
    Funded,
    InProgress,
    Completed,
    Disputed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Released,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub milestone_id: u32,
    pub description_hash: BytesN<32>,
    pub amount: i128,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub escrow_id: u64,
    pub client: Address,
    pub freelancer: Address,
    pub token: Address,
    pub total_amount: i128,
    pub status: EscrowStatus,
    pub milestones: Vec<Milestone>,
}

#[contracttype]
pub enum Resolution {
    RefundClient,
    PayFreelancer,
    Split,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneEvent {
    pub milestoneId: u32,
    pub amount: i128,
    pub status: Symbol,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractCreatedEvent {
    pub client: Address,
    pub freelancer: Address,
    pub totalAmount: i128,
    pub milestones: Vec<MilestoneEvent>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneSubmittedEvent {
    pub milestoneId: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneApprovedEvent {
    pub milestoneId: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FundsReleasedEvent {
    pub milestoneId: u32,
}

#[contracttype]
pub enum DataKey {
    Escrow(u64),
    EscrowCounter,
    Admin,
    ReputationContract,
    DisputeContract,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn init(env: Env, admin: Address, reputation_contract: Address, dispute_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ReputationContract, &reputation_contract);
        env.storage().instance().set(&DataKey::DisputeContract, &dispute_contract);
    }

    pub fn set_reputation_contract(env: Env, reputation_contract: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::ReputationContract, &reputation_contract);
    }

    pub fn set_dispute_contract(env: Env, dispute_contract: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::DisputeContract, &dispute_contract);
    }

    pub fn create_escrow(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
        milestones_input: Vec<(BytesN<32>, i128)>,
    ) -> u64 {
        let mut counter: u64 = env.storage().instance().get(&DataKey::EscrowCounter).unwrap_or(0);
        counter += 1;
        env.storage().instance().set(&DataKey::EscrowCounter, &counter);

        let mut total_amount: i128 = 0;
        let mut milestones = Vec::new(&env);
        let mut milestone_events = Vec::new(&env);

        for i in 0..milestones_input.len() {
            let (desc_hash, amount) = milestones_input.get(i).unwrap();
            if amount <= 0 {
                panic!("amount must be positive");
            }
            total_amount += amount;
            milestones.push_back(Milestone {
                milestone_id: i as u32 + 1,
                description_hash: desc_hash,
                amount,
                status: MilestoneStatus::Pending,
            });
            milestone_events.push_back(MilestoneEvent {
                milestoneId: i as u32 + 1,
                amount,
                status: Symbol::new(&env, "Pending"),
            });
        }

        let escrow = Escrow {
            escrow_id: counter,
            client: client.clone(),
            freelancer: freelancer.clone(),
            token,
            total_amount,
            status: EscrowStatus::Created,
            milestones,
        };

        env.storage().persistent().set(&DataKey::Escrow(counter), &escrow);

        let event_payload = ContractCreatedEvent {
            client: client.clone(),
            freelancer: freelancer.clone(),
            totalAmount: total_amount,
            milestones: milestone_events,
        };

        env.events().publish(
            (Symbol::new(&env, "ContractCreated"), counter),
            event_payload,
        );

        counter
    }

    pub fn fund_escrow(env: Env, escrow_id: u64, from: Address) {
        let mut escrow = Self::get_escrow(env.clone(), escrow_id);
        if escrow.status != EscrowStatus::Created {
            panic!("escrow already funded or resolved");
        }

        if from != escrow.client {
            panic!("unauthorized funder");
        }
        from.require_auth();

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&from, &env.current_contract_address(), &escrow.total_amount);

        escrow.status = EscrowStatus::Funded;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (Symbol::new(&env, "Funded"), escrow_id),
            escrow.total_amount,
        );
    }

    pub fn submit_milestone(env: Env, escrow_id: u64, milestone_id: u32, freelancer: Address) {
        let mut escrow = Self::get_escrow(env.clone(), escrow_id);
        if escrow.status != EscrowStatus::Funded && escrow.status != EscrowStatus::InProgress {
            panic!("escrow is not in a submittable state");
        }

        if freelancer != escrow.freelancer {
            panic!("unauthorized freelancer");
        }
        freelancer.require_auth();

        let mut milestone_found = false;
        let mut updated_milestones = Vec::new(&env);

        for i in 0..escrow.milestones.len() {
            let mut milestone = escrow.milestones.get(i).unwrap();
            if milestone.milestone_id == milestone_id {
                if milestone.status != MilestoneStatus::Pending {
                    panic!("milestone is not pending");
                }
                milestone.status = MilestoneStatus::Submitted;
                milestone_found = true;
            }
            updated_milestones.push_back(milestone);
        }

        if !milestone_found {
            panic!("milestone not found");
        }

        escrow.milestones = updated_milestones;
        escrow.status = EscrowStatus::InProgress;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (Symbol::new(&env, "MilestoneSubmitted"), escrow_id),
            MilestoneSubmittedEvent { milestoneId: milestone_id },
        );
    }

    pub fn approve_milestone(env: Env, escrow_id: u64, milestone_id: u32, client: Address) {
        let mut escrow = Self::get_escrow(env.clone(), escrow_id);
        if escrow.status == EscrowStatus::Cancelled || escrow.status == EscrowStatus::Completed || escrow.status == EscrowStatus::Disputed {
            panic!("escrow status blocks approval");
        }

        if client != escrow.client {
            panic!("unauthorized client");
        }
        client.require_auth();

        let mut milestone_amount: i128 = 0;
        let mut milestone_found = false;
        let mut updated_milestones = Vec::new(&env);
        let mut all_released = true;

        for i in 0..escrow.milestones.len() {
            let mut milestone = escrow.milestones.get(i).unwrap();
            if milestone.milestone_id == milestone_id {
                if milestone.status != MilestoneStatus::Submitted {
                    panic!("milestone is not submitted");
                }
                milestone.status = MilestoneStatus::Released;
                milestone_amount = milestone.amount;
                milestone_found = true;
            }
            if milestone.status != MilestoneStatus::Released {
                all_released = false;
            }
            updated_milestones.push_back(milestone);
        }

        if !milestone_found {
            panic!("milestone not found");
        }

        escrow.milestones = updated_milestones;

        // Perform token transfer from contract balance to freelancer
        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.freelancer, &milestone_amount);

        env.events().publish(
            (Symbol::new(&env, "MilestoneApproved"), escrow_id),
            MilestoneApprovedEvent { milestoneId: milestone_id },
        );

        env.events().publish(
            (Symbol::new(&env, "FundsReleased"), escrow_id),
            FundsReleasedEvent { milestoneId: milestone_id },
        );

        if all_released {
            escrow.status = EscrowStatus::Completed;

            // Trigger cross-contract completion record
            let reputation_addr: Option<Address> = env.storage().instance().get(&DataKey::ReputationContract);
            if let Some(rep_addr) = reputation_addr {
                env.invoke_contract::<()>(
                    &rep_addr,
                    &Symbol::new(&env, "record_completion"),
                    (escrow.freelancer.clone(), 5u32, true).into_val(&env),
                );
            }
        }

        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);
    }

    pub fn cancel_escrow(env: Env, escrow_id: u64, client: Address) {
        let mut escrow = Self::get_escrow(env.clone(), escrow_id);
        if client != escrow.client {
            panic!("unauthorized client");
        }
        client.require_auth();

        if escrow.status == EscrowStatus::Cancelled || escrow.status == EscrowStatus::Completed {
            panic!("escrow already finished");
        }

        // Check if any milestone has been approved/released
        for i in 0..escrow.milestones.len() {
            let milestone = escrow.milestones.get(i).unwrap();
            if milestone.status == MilestoneStatus::Released || milestone.status == MilestoneStatus::Approved {
                panic!("cannot cancel after milestone approval");
            }
        }

        let token_client = token::Client::new(&env, &escrow.token);
        let contract_balance = token_client.balance(&env.current_contract_address());
        if contract_balance > 0 {
            token_client.transfer(&env.current_contract_address(), &escrow.client, &contract_balance);
        }

        escrow.status = EscrowStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (Symbol::new(&env, "Cancelled"), escrow_id),
            contract_balance,
        );
    }

    pub fn raise_dispute(
        env: Env,
        escrow_id: u64,
        caller: Address,
        reason: Symbol,
        evidence_urls: Vec<Symbol>,
    ) {
        let mut escrow = Self::get_escrow(env.clone(), escrow_id);
        if caller != escrow.client && caller != escrow.freelancer {
            panic!("unauthorized caller");
        }
        caller.require_auth();

        if escrow.status == EscrowStatus::Completed || escrow.status == EscrowStatus::Cancelled || escrow.status == EscrowStatus::Disputed {
            panic!("invalid status for raising dispute");
        }

        escrow.status = EscrowStatus::Disputed;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        let dispute_contract: Address = env.storage().instance().get(&DataKey::DisputeContract).unwrap_or_else(|| panic!("dispute contract not initialized"));
        env.invoke_contract::<()>(
            &dispute_contract,
            &Symbol::new(&env, "raise_dispute"),
            (escrow_id, caller.clone(), reason, evidence_urls).into_val(&env),
        );
    }

    pub fn resolve_dispute_callback(env: Env, escrow_id: u64, resolution: Resolution) {
        let dispute_contract: Address = env.storage().instance().get(&DataKey::DisputeContract).unwrap();
        dispute_contract.require_auth();

        let mut escrow = Self::get_escrow(env.clone(), escrow_id);
        if escrow.status != EscrowStatus::Disputed {
            panic!("escrow must be in disputed state");
        }

        let token_client = token::Client::new(&env, &escrow.token);
        let balance = token_client.balance(&env.current_contract_address());

        if balance > 0 {
            match resolution {
                Resolution::RefundClient => {
                    token_client.transfer(&env.current_contract_address(), &escrow.client, &balance);
                }
                Resolution::PayFreelancer => {
                    token_client.transfer(&env.current_contract_address(), &escrow.freelancer, &balance);
                }
                Resolution::Split => {
                    let half = balance / 2;
                    let remainder = balance - half;
                    token_client.transfer(&env.current_contract_address(), &escrow.client, &half);
                    token_client.transfer(&env.current_contract_address(), &escrow.freelancer, &remainder);
                }
            }
        }

        escrow.status = EscrowStatus::Completed;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> Escrow {
        let key = DataKey::Escrow(escrow_id);
        env.storage().persistent().get(&key).unwrap_or_else(|| panic!("escrow not found"))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Env, Vec};

    // Mock Reputation Contract
    #[contract]
    pub struct MockReputationContract;

    #[contractimpl]
    impl MockReputationContract {
        pub fn record_completion(env: Env, contractor: Address, rating: u32, on_time: bool) {
            env.events().publish(
                (Symbol::new(&env, "ReputationRecorded"), contractor),
                (rating, on_time),
            );
        }
    }

    // Mock Dispute Contract
    #[contract]
    pub struct MockDisputeContract;

    #[contractimpl]
    impl MockDisputeContract {
        pub fn raise_dispute(
            env: Env,
            escrow_id: u64,
            raised_by: Address,
            _reason: Symbol,
            _evidence_urls: Vec<Symbol>,
        ) {
            env.events().publish(
                (Symbol::new(&env, "DisputeMockRaised"), escrow_id),
                raised_by,
            );
        }
    }

    fn setup_test_env(env: &Env) -> (Address, Address, Address, Address, Address, Address) {
        let admin = Address::generate(env);
        let client = Address::generate(env);
        let freelancer = Address::generate(env);
        let token_admin = Address::generate(env);

        let token_address = env.register_stellar_asset_contract(token_admin);

        let rep_id = env.register_contract(None, MockReputationContract);
        let dispute_id = env.register_contract(None, MockDisputeContract);

        (admin, client, freelancer, token_address, rep_id, dispute_id)
    }

    #[test]
    fn test_create_and_fund_escrow() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, client, freelancer, token_address, rep_id, dispute_id) = setup_test_env(&env);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 200i128));
        milestones.push_back((desc_hash.clone(), 300i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);
        assert_eq!(escrow_id, 1);

        let escrow = escrow_client.get_escrow(&escrow_id);
        assert_eq!(escrow.total_amount, 500);
        assert_eq!(escrow.status, EscrowStatus::Created);

        // Mint tokens to client
        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &1000i128);

        // Fund escrow
        escrow_client.fund_escrow(&escrow_id, &client);

        let updated_escrow = escrow_client.get_escrow(&escrow_id);
        assert_eq!(updated_escrow.status, EscrowStatus::Funded);

        let token_client = token::Client::new(&env, &token_address);
        assert_eq!(token_client.balance(&escrow_contract_id), 500);
    }

    #[test]
    fn test_milestone_lifecycle_to_completion() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, client, freelancer, token_address, rep_id, dispute_id) = setup_test_env(&env);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 500i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);

        // Mint and fund
        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &500i128);
        escrow_client.fund_escrow(&escrow_id, &client);

        // Submit milestone
        escrow_client.submit_milestone(&escrow_id, &1, &freelancer);
        let escrow_after_submit = escrow_client.get_escrow(&escrow_id);
        assert_eq!(escrow_after_submit.milestones.get(0).unwrap().status, MilestoneStatus::Submitted);

        // Approve milestone
        escrow_client.approve_milestone(&escrow_id, &1, &client);

        let escrow_final = escrow_client.get_escrow(&escrow_id);
        assert_eq!(escrow_final.status, EscrowStatus::Completed);
        assert_eq!(escrow_final.milestones.get(0).unwrap().status, MilestoneStatus::Released);

        // Verify balance transfer
        let token_client = token::Client::new(&env, &token_address);
        assert_eq!(token_client.balance(&freelancer), 500);
    }

    #[test]
    #[should_panic]
    fn test_submit_milestone_by_wrong_address() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, client, freelancer, token_address, rep_id, dispute_id) = setup_test_env(&env);
        let wrong_freelancer = Address::generate(&env);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 500i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);

        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &500i128);
        escrow_client.fund_escrow(&escrow_id, &client);

        // Submit milestone by wrong address should panic
        escrow_client.submit_milestone(&escrow_id, &1, &wrong_freelancer);
    }

    #[test]
    #[should_panic]
    fn test_double_approval_panics() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, client, freelancer, token_address, rep_id, dispute_id) = setup_test_env(&env);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 200i128));
        milestones.push_back((desc_hash.clone(), 300i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);

        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &500i128);
        escrow_client.fund_escrow(&escrow_id, &client);

        escrow_client.submit_milestone(&escrow_id, &1, &freelancer);
        escrow_client.approve_milestone(&escrow_id, &1, &client);

        // Approve again - should panic
        escrow_client.approve_milestone(&escrow_id, &1, &client);
    }

    #[test]
    fn test_cancel_escrow_refunds() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, client, freelancer, token_address, rep_id, dispute_id) = setup_test_env(&env);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 500i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);

        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &500i128);
        escrow_client.fund_escrow(&escrow_id, &client);

        // Cancel
        escrow_client.cancel_escrow(&escrow_id, &client);

        let escrow = escrow_client.get_escrow(&escrow_id);
        assert_eq!(escrow.status, EscrowStatus::Cancelled);

        // Client should have their 500 tokens back
        let token_client = token::Client::new(&env, &token_address);
        assert_eq!(token_client.balance(&client), 500);
        assert_eq!(token_client.balance(&escrow_contract_id), 0);
    }

    #[test]
    #[should_panic]
    fn test_cancel_escrow_after_approval_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, client, freelancer, token_address, rep_id, dispute_id) = setup_test_env(&env);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 200i128));
        milestones.push_back((desc_hash.clone(), 300i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);

        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &500i128);
        escrow_client.fund_escrow(&escrow_id, &client);

        escrow_client.submit_milestone(&escrow_id, &1, &freelancer);
        escrow_client.approve_milestone(&escrow_id, &1, &client);

        // Attempting to cancel should panic since a milestone was approved/released
        escrow_client.cancel_escrow(&escrow_id, &client);
    }

    #[test]
    fn test_dispute_resolution_refund_client() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let client = Address::generate(&env);
        let freelancer = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_address = env.register_stellar_asset_contract(token_admin);

        let rep_id = env.register_contract(None, MockReputationContract);
        
        // Deployed real DisputeContract for integration verification
        let dispute_id = env.register_contract(None, dispute::DisputeContract);
        let dispute_client = dispute::DisputeContractClient::new(&env, &dispute_id);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);
        dispute_client.init(&admin, &escrow_contract_id, &admin); // admin is arbitrator

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 500i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);

        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &500i128);
        escrow_client.fund_escrow(&escrow_id, &client);

        // Raise dispute
        let reason = Symbol::new(&env, "late");
        let evidence_urls = Vec::new(&env);
        escrow_client.raise_dispute(&escrow_id, &client, &reason, &evidence_urls);

        let escrow = escrow_client.get_escrow(&escrow_id);
        assert_eq!(escrow.status, EscrowStatus::Disputed);

        // Resolve dispute using arbitrator
        env.as_contract(&admin, || {
            dispute_client.resolve_dispute(&escrow_id, &dispute::Resolution::RefundClient);
        });

        let escrow_resolved = escrow_client.get_escrow(&escrow_id);
        assert_eq!(escrow_resolved.status, EscrowStatus::Completed);

        let token_client = token::Client::new(&env, &token_address);
        assert_eq!(token_client.balance(&client), 500);
        assert_eq!(token_client.balance(&freelancer), 0);
    }

    #[test]
    fn test_real_reputation_cross_contract_integration() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let client = Address::generate(&env);
        let freelancer = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_address = env.register_stellar_asset_contract(token_admin);

        let rep_id = env.register_contract(None, reputation::ReputationContract);
        let rep_client = reputation::ReputationContractClient::new(&env, &rep_id);

        let dispute_id = env.register_contract(None, MockDisputeContract);

        let escrow_contract_id = env.register_contract(None, EscrowContract);
        let escrow_client = EscrowContractClient::new(&env, &escrow_contract_id);

        escrow_client.init(&admin, &rep_id, &dispute_id);
        rep_client.init(&admin, &escrow_contract_id);

        let mut milestones = Vec::new(&env);
        let desc_hash = BytesN::from_array(&env, &[0u8; 32]);
        milestones.push_back((desc_hash.clone(), 500i128));

        let escrow_id = escrow_client.create_escrow(&client, &freelancer, &token_address, &milestones);

        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);
        token_admin_client.mint(&client, &500i128);
        escrow_client.fund_escrow(&escrow_id, &client);

        escrow_client.submit_milestone(&escrow_id, &1, &freelancer);
        escrow_client.approve_milestone(&escrow_id, &1, &client);

        let reputation_score = rep_client.get_score(&freelancer);
        assert_eq!(reputation_score.completed_contracts, 1);
        assert_eq!(reputation_score.total_rating_points, 5);
        assert_eq!(reputation_score.on_time_count, 1);
    }
}
