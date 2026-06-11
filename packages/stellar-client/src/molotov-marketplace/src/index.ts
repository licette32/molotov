import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU",
  }
} as const


/**
 * Sale type. `Auction` is reserved (its `buy` path panics `NotImplemented`,
 * enabled later via upgrade); `OpenEdition` sell-through is wired in a later step.
 */
export type ListingKind = {tag: "FixedPrice", values: void} | {tag: "OpenEdition", values: void} | {tag: "Auction", values: void};



/**
 * One wallet of a primary-sale split: a share of the post-fee proceeds in bps.
 * Mirrors the NFT's royalty-recipient shape (shares must sum to 10000, cap 10).
 */
export interface RoyaltyRecipient {
  address: string;
  share_bps: u32;
}





export interface Client {
  /**
   * Construct and simulate a buy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Atomic purchase + distribution. Reuses [`distribute`] for all money math;
   * this function only orchestrates escrow, transfers, and state.
   * 
   * Checks-effects-interactions: the listing is marked `Sold` and persisted
   * **before** any token moves, so a re-entrant or repeat `buy` on the same
   * listing fails. The marketplace never custodies funds — payments go straight
   * from buyer to each recipient and the NFT moves straight to the buyer, so the
   * contract holds a zero balance afterwards.
   * 
   * Self-referral: if `referrer` is the buyer or the seller, the referral is
   * zeroed and the treasury keeps the full fee; the sale still proceeds.
   */
  buy: ({buyer, listing_id, referrer}: {buyer: string, listing_id: u64, referrer: Option<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a list transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a listing and escrow the token(s) into the contract. Returns the new
   * listing id.
   * 
   * `primary_split = Some(..)` is a primary sale (post-fee proceeds split across
   * the artist's wallets); `None` is a resale (royalty via the NFT, remainder to
   * the seller). For `OpenEdition`, the artist pre-mints `editions` contiguous
   * tokens starting at `token_id`; all are escrowed and sold from inventory.
   * 
   * Guards (P9, enforced here, re-checked in `buy`): `referral_bps ≤ fee_bps`
   * and `fee_bps + royalty_bps ≤ 10000`; the currency must be allowlisted; the
   * primary split is validated up-front via a dry run of [`distribute`].
   */
  list: ({seller, nft, token_id, price, currency, kind, editions, ends_at, primary_split, referral_bps}: {seller: string, nft: string, token_id: u32, price: i128, currency: string, kind: ListingKind, editions: u32, ends_at: u64, primary_split: Option<Array<RoyaltyRecipient>>, referral_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel an active listing and return the unsold escrowed token(s) to the
   * seller. Only the seller can cancel, only while `Active`. Checks-effects-
   * interactions: the status flips to `Cancelled` before any token moves, and
   * the contract holds no residual afterwards.
   */
  cancel: ({seller, listing_id}: {seller: string, listing_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current platform fee in basis points.
   */
  fee_bps: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract WASM in place (SEP-49). Owner-gated. Mirrors the NFT
   * and ArtistRegistry.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current treasury address.
   */
  treasury: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a get_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `Some(Address)` if ownership is set, or `None` if ownership has
   * been renounced.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  get_owner: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a accept_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accepts a pending ownership transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   * 
   * # Events
   * 
   * * topics - `["ownership_transfer_completed"]`
   * * data - `[new_owner: Address]`
   */
  accept_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a renounce_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renounces ownership of the contract.
   * 
   * Permanently removes the owner, disabling all functions gated by
   * `#[only_owner]`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`OwnableError::TransferInProgress`] - If there is a pending ownership
   * transfer.
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * 
   * # Notes
   * 
   * * Authorization for the current owner is required.
   */
  renounce_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiates a 2-step ownership transfer to a new address.
   * 
   * Requires authorization from the current owner. The new owner must later
   * call `accept_ownership()` to complete the transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `new_owner` - The proposed new owner.
   * * `live_until_ledger` - Ledger number until which the new owner can
   * accept. A value of `0` cancels any pending transfer.
   * 
   * # Errors
   * 
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   * 
   * # Notes
   * 
   * * Authorization for the current owner is required.
   */
  transfer_ownership: ({new_owner, live_until_ledger}: {new_owner: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_allowed_currency transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allowlist (or de-list) a payment SAC. Owner-gated. `buy` refuses to settle
   * in a currency that is not allowlisted — the contract never calls an
   * arbitrary token.
   */
  set_allowed_currency: ({currency, allowed}: {currency: string, allowed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, fee_bps, treasury}: {admin: string, fee_bps: u32, treasury: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, fee_bps, treasury}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABQAAASZFbWl0dGVkIG9uIGEgY29tcGxldGVkIHNhbGUuIENhcnJpZXMgZXZlcnl0aGluZyB0aGUgaW5kZXhlciBuZWVkcyB0bwpyZWNvbnN0cnVjdCB0aGUgZGlzdHJpYnV0aW9uOiBgZmVlX3BhaWRgIGlzIHRoZSB0b3RhbCBwbGF0Zm9ybSBmZWUsIG9mIHdoaWNoCmByZWZlcnJhbF9wYWlkYCB3ZW50IHRvIHRoZSByZWZlcnJlciAoc28gdHJlYXN1cnkgPSBgZmVlX3BhaWQg4oiSIHJlZmVycmFsX3BhaWRgKTsKYHJveWFsdHlfcGFpZGAgaXMgdGhlIHJlc2FsZSByb3lhbHR5IHRvdGFsICgwIG9uIGEgcHJpbWFyeSBzYWxlKS4AAAAAAAAAAAAEU29sZAAAAAEAAAAEc29sZAAAAAkAAAAAAAAACmxpc3RpbmdfaWQAAAAAAAYAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAAAAAAAAhjdXJyZW5jeQAAABMAAAAAAAAAAAAAAAxyb3lhbHR5X3BhaWQAAAALAAAAAAAAAAAAAAANcmVmZXJyYWxfcGFpZAAAAAAAAAsAAAAAAAAAAAAAAAhmZWVfcGFpZAAAAAsAAAAAAAAAAg==",
        "AAAAAgAAAJpTYWxlIHR5cGUuIGBBdWN0aW9uYCBpcyByZXNlcnZlZCAoaXRzIGBidXlgIHBhdGggcGFuaWNzIGBOb3RJbXBsZW1lbnRlZGAsCmVuYWJsZWQgbGF0ZXIgdmlhIHVwZ3JhZGUpOyBgT3BlbkVkaXRpb25gIHNlbGwtdGhyb3VnaCBpcyB3aXJlZCBpbiBhIGxhdGVyIHN0ZXAuAAAAAAAAAAAAC0xpc3RpbmdLaW5kAAAAAAMAAAAAAAAAAAAAAApGaXhlZFByaWNlAAAAAAAAAAAAAAAAAAtPcGVuRWRpdGlvbgAAAAAAAAAAAAAAAAdBdWN0aW9uAA==",
        "AAAAAAAAAmxBdG9taWMgcHVyY2hhc2UgKyBkaXN0cmlidXRpb24uIFJldXNlcyBbYGRpc3RyaWJ1dGVgXSBmb3IgYWxsIG1vbmV5IG1hdGg7CnRoaXMgZnVuY3Rpb24gb25seSBvcmNoZXN0cmF0ZXMgZXNjcm93LCB0cmFuc2ZlcnMsIGFuZCBzdGF0ZS4KCkNoZWNrcy1lZmZlY3RzLWludGVyYWN0aW9uczogdGhlIGxpc3RpbmcgaXMgbWFya2VkIGBTb2xkYCBhbmQgcGVyc2lzdGVkCioqYmVmb3JlKiogYW55IHRva2VuIG1vdmVzLCBzbyBhIHJlLWVudHJhbnQgb3IgcmVwZWF0IGBidXlgIG9uIHRoZSBzYW1lCmxpc3RpbmcgZmFpbHMuIFRoZSBtYXJrZXRwbGFjZSBuZXZlciBjdXN0b2RpZXMgZnVuZHMg4oCUIHBheW1lbnRzIGdvIHN0cmFpZ2h0CmZyb20gYnV5ZXIgdG8gZWFjaCByZWNpcGllbnQgYW5kIHRoZSBORlQgbW92ZXMgc3RyYWlnaHQgdG8gdGhlIGJ1eWVyLCBzbyB0aGUKY29udHJhY3QgaG9sZHMgYSB6ZXJvIGJhbGFuY2UgYWZ0ZXJ3YXJkcy4KClNlbGYtcmVmZXJyYWw6IGlmIGByZWZlcnJlcmAgaXMgdGhlIGJ1eWVyIG9yIHRoZSBzZWxsZXIsIHRoZSByZWZlcnJhbCBpcwp6ZXJvZWQgYW5kIHRoZSB0cmVhc3VyeSBrZWVwcyB0aGUgZnVsbCBmZWU7IHRoZSBzYWxlIHN0aWxsIHByb2NlZWRzLgAAAANidXkAAAAAAwAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAApsaXN0aW5nX2lkAAAAAAAGAAAAAAAAAAhyZWZlcnJlcgAAA+gAAAATAAAAAA==",
        "AAAABQAAAIVFbWl0dGVkIHdoZW4gYSBsaXN0aW5nIGlzIGNyZWF0ZWQuIENhcnJpZXMgdGhlIGZ1bGwgbGlzdGluZyBzbyB0aGUgaW5kZXhlciBjYW4KcHJvamVjdCBicm93c2UvbGlzdGluZyBzdGF0ZSB3aXRob3V0IGEgZm9sbG93LXVwIHJlYWQuAAAAAAAAAAAAAA5MaXN0aW5nQ3JlYXRlZAAAAAAAAQAAAA9saXN0aW5nX2NyZWF0ZWQAAAAACwAAAAAAAAAKbGlzdGluZ19pZAAAAAAABgAAAAEAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAEAAAAAAAAAA25mdAAAAAATAAAAAAAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAAAAAAIY3VycmVuY3kAAAATAAAAAAAAAAAAAAAEa2luZAAAB9AAAAALTGlzdGluZ0tpbmQAAAAAAAAAAAAAAAAOZWRpdGlvbnNfdG90YWwAAAAAAAQAAAAAAAAAAAAAAAdlbmRzX2F0AAAAAAYAAAAAAAAAAAAAAAxyZWZlcnJhbF9icHMAAAAEAAAAAAAAAAAAAAANcHJpbWFyeV9zcGxpdAAAAAAAA+gAAAPqAAAH0AAAABBSb3lhbHR5UmVjaXBpZW50AAAAAAAAAAI=",
        "AAAAAAAAAmVDcmVhdGUgYSBsaXN0aW5nIGFuZCBlc2Nyb3cgdGhlIHRva2VuKHMpIGludG8gdGhlIGNvbnRyYWN0LiBSZXR1cm5zIHRoZSBuZXcKbGlzdGluZyBpZC4KCmBwcmltYXJ5X3NwbGl0ID0gU29tZSguLilgIGlzIGEgcHJpbWFyeSBzYWxlIChwb3N0LWZlZSBwcm9jZWVkcyBzcGxpdCBhY3Jvc3MKdGhlIGFydGlzdCdzIHdhbGxldHMpOyBgTm9uZWAgaXMgYSByZXNhbGUgKHJveWFsdHkgdmlhIHRoZSBORlQsIHJlbWFpbmRlciB0bwp0aGUgc2VsbGVyKS4gRm9yIGBPcGVuRWRpdGlvbmAsIHRoZSBhcnRpc3QgcHJlLW1pbnRzIGBlZGl0aW9uc2AgY29udGlndW91cwp0b2tlbnMgc3RhcnRpbmcgYXQgYHRva2VuX2lkYDsgYWxsIGFyZSBlc2Nyb3dlZCBhbmQgc29sZCBmcm9tIGludmVudG9yeS4KCkd1YXJkcyAoUDksIGVuZm9yY2VkIGhlcmUsIHJlLWNoZWNrZWQgaW4gYGJ1eWApOiBgcmVmZXJyYWxfYnBzIOKJpCBmZWVfYnBzYAphbmQgYGZlZV9icHMgKyByb3lhbHR5X2JwcyDiiaQgMTAwMDBgOyB0aGUgY3VycmVuY3kgbXVzdCBiZSBhbGxvd2xpc3RlZDsgdGhlCnByaW1hcnkgc3BsaXQgaXMgdmFsaWRhdGVkIHVwLWZyb250IHZpYSBhIGRyeSBydW4gb2YgW2BkaXN0cmlidXRlYF0uAAAAAAAABGxpc3QAAAAKAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAAA25mdAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAIY3VycmVuY3kAAAATAAAAAAAAAARraW5kAAAH0AAAAAtMaXN0aW5nS2luZAAAAAAAAAAACGVkaXRpb25zAAAABAAAAAAAAAAHZW5kc19hdAAAAAAGAAAAAAAAAA1wcmltYXJ5X3NwbGl0AAAAAAAD6AAAA+oAAAfQAAAAEFJveWFsdHlSZWNpcGllbnQAAAAAAAAADHJlZmVycmFsX2JwcwAAAAQAAAABAAAABg==",
        "AAAAAQAAAJpPbmUgd2FsbGV0IG9mIGEgcHJpbWFyeS1zYWxlIHNwbGl0OiBhIHNoYXJlIG9mIHRoZSBwb3N0LWZlZSBwcm9jZWVkcyBpbiBicHMuCk1pcnJvcnMgdGhlIE5GVCdzIHJveWFsdHktcmVjaXBpZW50IHNoYXBlIChzaGFyZXMgbXVzdCBzdW0gdG8gMTAwMDAsIGNhcCAxMCkuAAAAAAAAAAAAEFJveWFsdHlSZWNpcGllbnQAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAACXNoYXJlX2JwcwAAAAAAAAQ=",
        "AAAABQAAADJFbWl0dGVkIHdoZW4gYSBsaXN0aW5nIGlzIGNhbmNlbGxlZCBieSBpdHMgc2VsbGVyLgAAAAAAAAAAABBMaXN0aW5nQ2FuY2VsbGVkAAAAAQAAABFsaXN0aW5nX2NhbmNlbGxlZAAAAAAAAAIAAAAAAAAACmxpc3RpbmdfaWQAAAAAAAYAAAABAAAAAAAAAAZzZWxsZXIAAAAAABMAAAABAAAAAg==",
        "AAAAAAAAAQVDYW5jZWwgYW4gYWN0aXZlIGxpc3RpbmcgYW5kIHJldHVybiB0aGUgdW5zb2xkIGVzY3Jvd2VkIHRva2VuKHMpIHRvIHRoZQpzZWxsZXIuIE9ubHkgdGhlIHNlbGxlciBjYW4gY2FuY2VsLCBvbmx5IHdoaWxlIGBBY3RpdmVgLiBDaGVja3MtZWZmZWN0cy0KaW50ZXJhY3Rpb25zOiB0aGUgc3RhdHVzIGZsaXBzIHRvIGBDYW5jZWxsZWRgIGJlZm9yZSBhbnkgdG9rZW4gbW92ZXMsIGFuZAp0aGUgY29udHJhY3QgaG9sZHMgbm8gcmVzaWR1YWwgYWZ0ZXJ3YXJkcy4AAAAAAAAGY2FuY2VsAAAAAAACAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAACmxpc3RpbmdfaWQAAAAAAAYAAAAA",
        "AAAAAAAAACVDdXJyZW50IHBsYXRmb3JtIGZlZSBpbiBiYXNpcyBwb2ludHMuAAAAAAAAB2ZlZV9icHMAAAAAAAAAAAEAAAAE",
        "AAAAAAAAAF1VcGdyYWRlIHRoZSBjb250cmFjdCBXQVNNIGluIHBsYWNlIChTRVAtNDkpLiBPd25lci1nYXRlZC4gTWlycm9ycyB0aGUgTkZUCmFuZCBBcnRpc3RSZWdpc3RyeS4AAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAABlDdXJyZW50IHRyZWFzdXJ5IGFkZHJlc3MuAAAAAAAACHRyZWFzdXJ5AAAAAAAAAAEAAAAT",
        "AAAAAAAAAJBSZXR1cm5zIGBTb21lKEFkZHJlc3MpYCBpZiBvd25lcnNoaXAgaXMgc2V0LCBvciBgTm9uZWAgaWYgb3duZXJzaGlwIGhhcwpiZWVuIHJlbm91bmNlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAJZ2V0X293bmVyAAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAI1Jbml0aWFsaXplcyB0aGUgbWFya2V0cGxhY2Ugd2l0aCBgYWRtaW5gIGFzIG93bmVyLCB0aGUgcGxhdGZvcm0gYGZlZV9icHNgLAphbmQgdGhlIGB0cmVhc3VyeWAgdGhhdCBjb2xsZWN0cyBgZmVlIOKIkiByZWZlcnJhbGAgb24gZXZlcnkgc2FsZS4AAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHZmVlX2JwcwAAAAAEAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAA",
        "AAAAAAAAATBBY2NlcHRzIGEgcGVuZGluZyBvd25lcnNoaXAgdHJhbnNmZXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsib3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZCJdYAoqIGRhdGEgLSBgW25ld19vd25lcjogQWRkcmVzc11gAAAAEGFjY2VwdF9vd25lcnNoaXAAAAAAAAAAAA==",
        "AAAAAAAAAYVSZW5vdW5jZXMgb3duZXJzaGlwIG9mIHRoZSBjb250cmFjdC4KClBlcm1hbmVudGx5IHJlbW92ZXMgdGhlIG93bmVyLCBkaXNhYmxpbmcgYWxsIGZ1bmN0aW9ucyBnYXRlZCBieQpgI1tvbmx5X293bmVyXWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYE93bmFibGVFcnJvcjo6VHJhbnNmZXJJblByb2dyZXNzYF0gLSBJZiB0aGVyZSBpcyBhIHBlbmRpbmcgb3duZXJzaGlwCnRyYW5zZmVyLgoqIFtgT3duYWJsZUVycm9yOjpPd25lck5vdFNldGBdIC0gSWYgdGhlIG93bmVyIGlzIG5vdCBzZXQuCgojIE5vdGVzCgoqIEF1dGhvcml6YXRpb24gZm9yIHRoZSBjdXJyZW50IG93bmVyIGlzIHJlcXVpcmVkLgAAAAAAABJyZW5vdW5jZV9vd25lcnNoaXAAAAAAAAAAAAAA",
        "AAAAAAAAA45Jbml0aWF0ZXMgYSAyLXN0ZXAgb3duZXJzaGlwIHRyYW5zZmVyIHRvIGEgbmV3IGFkZHJlc3MuCgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGN1cnJlbnQgb3duZXIuIFRoZSBuZXcgb3duZXIgbXVzdCBsYXRlcgpjYWxsIGBhY2NlcHRfb3duZXJzaGlwKClgIHRvIGNvbXBsZXRlIHRoZSB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgbmV3X293bmVyYCAtIFRoZSBwcm9wb3NlZCBuZXcgb3duZXIuCiogYGxpdmVfdW50aWxfbGVkZ2VyYCAtIExlZGdlciBudW1iZXIgdW50aWwgd2hpY2ggdGhlIG5ldyBvd25lciBjYW4KYWNjZXB0LiBBIHZhbHVlIG9mIGAwYCBjYW5jZWxzIGFueSBwZW5kaW5nIHRyYW5zZmVyLgoKIyBFcnJvcnMKCiogW2BPd25hYmxlRXJyb3I6Ok93bmVyTm90U2V0YF0gLSBJZiB0aGUgb3duZXIgaXMgbm90IHNldC4KKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgb3duZXIgaXMgcmVxdWlyZWQuAAAAAAASdHJhbnNmZXJfb3duZXJzaGlwAAAAAAACAAAAAAAAAAluZXdfb3duZXIAAAAAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA",
        "AAAAAAAAAKFBbGxvd2xpc3QgKG9yIGRlLWxpc3QpIGEgcGF5bWVudCBTQUMuIE93bmVyLWdhdGVkLiBgYnV5YCByZWZ1c2VzIHRvIHNldHRsZQppbiBhIGN1cnJlbmN5IHRoYXQgaXMgbm90IGFsbG93bGlzdGVkIOKAlCB0aGUgY29udHJhY3QgbmV2ZXIgY2FsbHMgYW4KYXJiaXRyYXJ5IHRva2VuLgAAAAAAABRzZXRfYWxsb3dlZF9jdXJyZW5jeQAAAAIAAAAAAAAACGN1cnJlbmN5AAAAEwAAAAAAAAAHYWxsb3dlZAAAAAABAAAAAA==",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGluaXRpYXRlZC4AAAAAAAAAAAART3duZXJzaGlwVHJhbnNmZXIAAAAAAAABAAAAEm93bmVyc2hpcF90cmFuc2ZlcgAAAAAAAwAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gb3duZXJzaGlwIGlzIHJlbm91bmNlZC4AAAAAAAAAAAAST3duZXJzaGlwUmVub3VuY2VkAAAAAAABAAAAE293bmVyc2hpcF9yZW5vdW5jZWQAAAAAAQAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGNvbXBsZXRlZC4AAAAAAAAAAAAaT3duZXJzaGlwVHJhbnNmZXJDb21wbGV0ZWQAAAAAAAEAAAAcb3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAEAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    buy: this.txFromJSON<null>,
        list: this.txFromJSON<u64>,
        cancel: this.txFromJSON<null>,
        fee_bps: this.txFromJSON<u32>,
        upgrade: this.txFromJSON<null>,
        treasury: this.txFromJSON<string>,
        get_owner: this.txFromJSON<Option<string>>,
        accept_ownership: this.txFromJSON<null>,
        renounce_ownership: this.txFromJSON<null>,
        transfer_ownership: this.txFromJSON<null>,
        set_allowed_currency: this.txFromJSON<null>
  }
}