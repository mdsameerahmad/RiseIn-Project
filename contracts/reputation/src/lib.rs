#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReputationScore {
    pub wallet_address: Address,
    pub completed_contracts: u32,
    pub total_rating_points: u32,
    pub on_time_count: u32,
}

#[contracttype]
pub enum DataKey {
    Score(Address),
    EscrowContract,
    Admin,
}

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    pub fn init(env: Env, admin: Address, escrow_contract: Address) {
        if env.storage().instance().has(&DataKey::EscrowContract) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EscrowContract, &escrow_contract);
    }

    pub fn record_completion(
        env: Env,
        contractor_address: Address,
        rating: u32,
        on_time: bool,
    ) {
        let allowed_caller: Address = env
            .storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .unwrap_or_else(|| panic!("not initialized"));

        allowed_caller.require_auth();

        if rating > 5 {
            panic!("rating must be between 0 and 5");
        }

        let key = DataKey::Score(contractor_address.clone());
        let mut score = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(ReputationScore {
                wallet_address: contractor_address.clone(),
                completed_contracts: 0,
                total_rating_points: 0,
                on_time_count: 0,
            });

        score.completed_contracts += 1;
        score.total_rating_points += rating;
        if on_time {
            score.on_time_count += 1;
        }

        env.storage().persistent().set(&key, &score);
    }

    pub fn get_score(env: Env, address: Address) -> ReputationScore {
        let key = DataKey::Score(address.clone());
        env.storage().persistent().get(&key).unwrap_or(ReputationScore {
            wallet_address: address,
            completed_contracts: 0,
            total_rating_points: 0,
            on_time_count: 0,
        })
    }

    pub fn set_escrow_contract(env: Env, new_escrow: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"));
        admin.require_auth();
        env.storage().instance().set(&DataKey::EscrowContract, &new_escrow);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_initialization_and_default_score() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let contractor = Address::generate(&env);

        let contract_id = env.register_contract(None, ReputationContract);
        let client = ReputationContractClient::new(&env, &contract_id);

        client.init(&admin, &escrow);

        let score = client.get_score(&contractor);
        assert_eq!(score.completed_contracts, 0);
        assert_eq!(score.total_rating_points, 0);
        assert_eq!(score.on_time_count, 0);
        assert_eq!(score.wallet_address, contractor);
    }

    #[test]
    fn test_record_completion_success() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let contractor = Address::generate(&env);

        let contract_id = env.register_contract(None, ReputationContract);
        let client = ReputationContractClient::new(&env, &contract_id);

        client.init(&admin, &escrow);

        // Call by authorized escrow address
        env.as_contract(&escrow, || {
            client.record_completion(&contractor, &5, &true);
        });

        let score = client.get_score(&contractor);
        assert_eq!(score.completed_contracts, 1);
        assert_eq!(score.total_rating_points, 5);
        assert_eq!(score.on_time_count, 1);

        env.as_contract(&escrow, || {
            client.record_completion(&contractor, &4, &false);
        });

        let score2 = client.get_score(&contractor);
        assert_eq!(score2.completed_contracts, 2);
        assert_eq!(score2.total_rating_points, 9);
        assert_eq!(score2.on_time_count, 1);
    }

    #[test]
    #[should_panic]
    fn test_record_completion_unauthorized() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let contractor = Address::generate(&env);
        let unauthorized = Address::generate(&env);

        let contract_id = env.register_contract(None, ReputationContract);
        let client = ReputationContractClient::new(&env, &contract_id);

        client.init(&admin, &escrow);

        // Call by unauthorized address should panic
        env.as_contract(&unauthorized, || {
            client.record_completion(&contractor, &5, &true);
        });
    }
}
