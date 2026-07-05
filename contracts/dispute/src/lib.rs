#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, IntoVal, BytesN, Vec};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DisputeStatus {
    Open,
    Resolved,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Resolution {
    RefundClient,
    PayFreelancer,
    Split,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub escrow_id: u64,
    pub raised_by: Address,
    pub reason: Symbol,
    pub evidence_urls: Vec<Symbol>,
    pub status: DisputeStatus,
    pub resolution: Option<Resolution>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeRaisedEvent {
    pub raisedBy: Address,
    pub reason: Symbol,
    pub evidenceUrls: Vec<Symbol>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeResolvedEvent {
    pub resolution: Symbol,
}

#[contracttype]
pub enum DataKey {
    Dispute(u64),
    EscrowContract,
    Arbitrator,
    Admin,
}

#[contract]
pub struct DisputeContract;

#[contractimpl]
impl DisputeContract {
    pub fn init(env: Env, admin: Address, escrow_contract: Address, arbitrator: Address) {
        if env.storage().instance().has(&DataKey::EscrowContract) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EscrowContract, &escrow_contract);
        env.storage().instance().set(&DataKey::Arbitrator, &arbitrator);
    }

    pub fn raise_dispute(
        env: Env,
        escrow_id: u64,
        raised_by: Address,
        reason: Symbol,
        evidence_urls: Vec<Symbol>,
    ) {
        let escrow_addr: Address = env.storage().instance().get(&DataKey::EscrowContract).unwrap();
        escrow_addr.require_auth();

        let key = DataKey::Dispute(escrow_id);
        if env.storage().persistent().has(&key) {
            panic!("dispute already exists");
        }

        let dispute = Dispute {
            escrow_id,
            raised_by: raised_by.clone(),
            reason: reason.clone(),
            evidence_urls: evidence_urls.clone(),
            status: DisputeStatus::Open,
            resolution: None,
        };

        env.storage().persistent().set(&key, &dispute);

        env.events().publish(
            (Symbol::new(&env, "DisputeRaised"), escrow_id),
            DisputeRaisedEvent {
                raisedBy: raised_by,
                reason,
                evidenceUrls: evidence_urls,
            },
        );
    }

    pub fn resolve_dispute(
        env: Env,
        escrow_id: u64,
        resolution: Resolution,
    ) {
        let arbitrator: Address = env.storage().instance().get(&DataKey::Arbitrator).unwrap();
        arbitrator.require_auth();

        let key = DataKey::Dispute(escrow_id);
        let mut dispute: Dispute = env.storage().persistent().get(&key).unwrap_or_else(|| panic!("dispute not found"));

        if dispute.status == DisputeStatus::Resolved {
            panic!("dispute already resolved");
        }

        dispute.status = DisputeStatus::Resolved;
        dispute.resolution = Some(resolution);
        env.storage().persistent().set(&key, &dispute);

        let escrow_addr: Address = env.storage().instance().get(&DataKey::EscrowContract).unwrap();
        env.invoke_contract::<()>(
            &escrow_addr,
            &Symbol::new(&env, "resolve_dispute_callback"),
            (escrow_id, resolution).into_val(&env),
        );

        let resolution_sym = match resolution {
            Resolution::RefundClient => Symbol::new(&env, "RefundClient"),
            Resolution::PayFreelancer => Symbol::new(&env, "PayFreelancer"),
            Resolution::Split => Symbol::new(&env, "Split"),
        };

        env.events().publish(
            (Symbol::new(&env, "DisputeResolved"), escrow_id),
            DisputeResolvedEvent {
                resolution: resolution_sym,
            },
        );
    }

    pub fn get_dispute(env: Env, escrow_id: u64) -> Option<Dispute> {
        let key = DataKey::Dispute(escrow_id);
        env.storage().persistent().get(&key)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[contract]
    pub struct MockEscrowContract;

    #[contractimpl]
    impl MockEscrowContract {
        pub fn resolve_dispute_callback(env: Env, escrow_id: u64, resolution: Resolution) {
            env.events().publish(
                (Symbol::new(&env, "MockCallback"), escrow_id),
                resolution,
            );
        }
    }

    #[test]
    fn test_raise_and_resolve_dispute() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrator = Address::generate(&env);
        let client = Address::generate(&env);

        let mock_escrow_id = env.register_contract(None, MockEscrowContract);
        let dispute_contract_id = env.register_contract(None, DisputeContract);
        let dispute_client = DisputeContractClient::new(&env, &dispute_contract_id);

        dispute_client.init(&admin, &mock_escrow_id, &arbitrator);

        let reason = Symbol::new(&env, "late");
        let evidence_urls = Vec::new(&env);

        // Raise dispute as the mock escrow contract
        env.as_contract(&mock_escrow_id, || {
            dispute_client.raise_dispute(&1, &client, &reason, &evidence_urls);
        });

        let dispute_opt = dispute_client.get_dispute(&1);
        assert!(dispute_opt.is_some());
        let dispute = dispute_opt.unwrap();
        assert_eq!(dispute.status, DisputeStatus::Open);
        assert_eq!(dispute.raised_by, client);

        // Resolve dispute as arbitrator
        dispute_client.resolve_dispute(&1, &Resolution::RefundClient);

        let dispute_resolved = dispute_client.get_dispute(&1).unwrap();
        assert_eq!(dispute_resolved.status, DisputeStatus::Resolved);
        assert_eq!(dispute_resolved.resolution, Some(Resolution::RefundClient));
    }
}
