//! Molotov NFT — scaffold contract.
//!
//! Non-fungible token for the Molotov marketplace. This is the Paso 4 scaffold:
//! it wires up the OpenZeppelin Stellar extensions (Enumerable, Burnable,
//! Royalties) under Ownable access control and proves the build/deploy pipeline
//! to testnet. The production logic (immutable royalties, ArtistRegistry gating,
//! multi-recipient splits) is implemented in a later step.

#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String};
use stellar_access::ownable::{set_owner, Ownable};
use stellar_macros::only_owner;
use stellar_tokens::non_fungible::{
    burnable::NonFungibleBurnable,
    enumerable::{Enumerable, NonFungibleEnumerable},
    royalties::NonFungibleRoyalties,
    Base, NonFungibleToken,
};

#[contract]
pub struct MolotovNft;

#[contractimpl]
impl MolotovNft {
    /// Initialize the collection.
    ///
    /// `owner` controls minting and royalty configuration. `default_royalty_bps`
    /// is the collection-wide royalty in basis points (e.g. 500 = 5%).
    pub fn __constructor(
        e: &Env,
        owner: Address,
        uri: String,
        name: String,
        symbol: String,
        default_royalty_bps: u32,
    ) {
        set_owner(e, &owner);
        Base::set_metadata(e, uri, name, symbol);
        Base::set_default_royalty(e, &owner, default_royalty_bps);
    }

    /// Mint a token with a sequential ID to `to`. Only the owner can mint.
    #[only_owner]
    pub fn mint(e: &Env, to: Address) -> u32 {
        Enumerable::sequential_mint(e, &to)
    }

    /// Mint a token and attach a token-specific royalty. Only the owner can mint.
    #[only_owner]
    pub fn mint_with_royalty(
        e: &Env,
        to: Address,
        receiver: Address,
        basis_points: u32,
    ) -> u32 {
        let token_id = Enumerable::sequential_mint(e, &to);
        Base::set_token_royalty(e, token_id, &receiver, basis_points);
        token_id
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for MolotovNft {
    type ContractType = Enumerable;
}

#[contractimpl(contracttrait)]
impl NonFungibleEnumerable for MolotovNft {}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for MolotovNft {}

#[contractimpl(contracttrait)]
impl NonFungibleRoyalties for MolotovNft {
    #[only_owner]
    fn set_default_royalty(e: &Env, receiver: Address, basis_points: u32, _operator: Address) {
        Base::set_default_royalty(e, &receiver, basis_points);
    }

    #[only_owner]
    fn set_token_royalty(
        e: &Env,
        token_id: u32,
        receiver: Address,
        basis_points: u32,
        _operator: Address,
    ) {
        Base::set_token_royalty(e, token_id, &receiver, basis_points);
    }

    #[only_owner]
    fn remove_token_royalty(e: &Env, token_id: u32, _operator: Address) {
        Base::remove_token_royalty(e, token_id);
    }
}

#[contractimpl(contracttrait)]
impl Ownable for MolotovNft {}

#[cfg(test)]
mod test;
