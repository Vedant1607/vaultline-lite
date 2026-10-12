use anchor_lang::prelude::*;

#[cfg(test)]
mod tests;

declare_id!("EZsSZystDUECB5PFCsPvDMyehkAtx8he1r2KjYYxwFmu");

#[program]
pub mod vault {
    use super::*;

    pub fn register_document(
        ctx: Context<RegisterDocument>,
        document_hash: [u8; 32],
    ) -> Result<()> {
        let document_record = &mut ctx.accounts.document_record;
        document_record.document_hash = document_hash;
        document_record.registrant = ctx.accounts.registrant.key();
        document_record.registered_at = Clock::get()?.unix_timestamp;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(document_hash: [u8; 32])]
pub struct RegisterDocument<'info> {
    #[account(mut)]
    pub registrant: Signer<'info>,
    #[account(
        init,
        payer = registrant,
        space = DocumentRecord::SPACE,
        seeds = [b"document", document_hash.as_ref()],
        bump,
    )]
    pub document_record: Account<'info, DocumentRecord>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct DocumentRecord {
    pub document_hash: [u8; 32],
    pub registrant: Pubkey,
    pub registered_at: i64,
}

impl DocumentRecord {
    pub const SPACE: usize = 8 + 32 + 32 + 8;
}
