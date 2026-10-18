#[cfg(test)]
mod tests {
    use crate::{DocumentRecord, ID as PROGRAM_ID};
    use anchor_lang::{prelude::AccountDeserialize, system_program};
    use litesvm::LiteSVM;
    use solana_sdk::{
        clock::Clock,
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        transaction::Transaction,
    };

    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
    const REGISTRATION_TIMESTAMP: i64 = 1_700_000_000;

    fn get_document_record_pda(document_hash: &[u8; 32]) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"document", document_hash], &PROGRAM_ID)
    }

    fn create_register_document_ix(
        registrant: &Pubkey,
        document_record: &Pubkey,
        document_hash: [u8; 32],
    ) -> Instruction {
        // Anchor discriminator for "register_document" = hash("global:register_document")[0..8]
        let discriminator: [u8; 8] = [108, 34, 153, 39, 82, 41, 133, 73];
        let mut data = discriminator.to_vec();
        data.extend_from_slice(&document_hash);

        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(*registrant, true),
                AccountMeta::new(*document_record, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data,
        }
    }

    fn new_svm() -> LiteSVM {
        let mut svm = LiteSVM::new();
        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();
        svm.set_sysvar(&Clock {
            unix_timestamp: REGISTRATION_TIMESTAMP,
            ..Clock::default()
        });
        svm
    }

    fn deserialize_document_record(svm: &LiteSVM, document_record: &Pubkey) -> DocumentRecord {
        let account = svm.get_account(document_record).unwrap();
        assert_eq!(account.owner, PROGRAM_ID);
        DocumentRecord::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    #[test]
    fn test_register_document_creates_expected_record() {
        let mut svm = new_svm();
        let registrant = Keypair::new();
        svm.airdrop(&registrant.pubkey(), 10 * LAMPORTS_PER_SOL)
            .unwrap();

        let document_hash = [7; 32];
        let (document_record, _bump) = get_document_record_pda(&document_hash);
        let instruction =
            create_register_document_ix(&registrant.pubkey(), &document_record, document_hash);
        let expected_timestamp = svm.get_sysvar::<Clock>().unix_timestamp;
        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&registrant.pubkey()),
            &[&registrant],
            svm.latest_blockhash(),
        );

        svm.send_transaction(transaction).unwrap();

        let record = deserialize_document_record(&svm, &document_record);
        assert_eq!(record.document_hash, document_hash);
        assert_eq!(record.registrant, registrant.pubkey());
        assert_eq!(record.registered_at, expected_timestamp);
        assert_eq!(
            record.registered_at,
            svm.get_sysvar::<Clock>().unix_timestamp
        );
    }

    #[test]
    fn test_registering_same_hash_twice_fails_without_overwriting_record() {
        let mut svm = new_svm();
        let first_registrant = Keypair::new();
        let second_registrant = Keypair::new();
        svm.airdrop(&first_registrant.pubkey(), 10 * LAMPORTS_PER_SOL)
            .unwrap();
        svm.airdrop(&second_registrant.pubkey(), 10 * LAMPORTS_PER_SOL)
            .unwrap();

        let document_hash = [11; 32];
        let (document_record, _bump) = get_document_record_pda(&document_hash);
        let first_instruction = create_register_document_ix(
            &first_registrant.pubkey(),
            &document_record,
            document_hash,
        );
        let first_transaction = Transaction::new_signed_with_payer(
            &[first_instruction],
            Some(&first_registrant.pubkey()),
            &[&first_registrant],
            svm.latest_blockhash(),
        );
        svm.send_transaction(first_transaction).unwrap();

        let duplicate_instruction = create_register_document_ix(
            &second_registrant.pubkey(),
            &document_record,
            document_hash,
        );
        let duplicate_transaction = Transaction::new_signed_with_payer(
            &[duplicate_instruction],
            Some(&second_registrant.pubkey()),
            &[&second_registrant],
            svm.latest_blockhash(),
        );

        let failure = svm.send_transaction(duplicate_transaction).unwrap_err();
        assert!(
            failure
                .meta
                .logs
                .iter()
                .any(|log| log.contains("already in use")),
            "duplicate registration should fail because the record PDA already exists: {failure:?}"
        );

        let record = deserialize_document_record(&svm, &document_record);
        assert_eq!(record.document_hash, document_hash);
        assert_eq!(record.registrant, first_registrant.pubkey());
    }

    #[test]
    fn test_registering_different_hashes_creates_different_records() {
        let mut svm = new_svm();
        let registrant = Keypair::new();
        svm.airdrop(&registrant.pubkey(), 10 * LAMPORTS_PER_SOL)
            .unwrap();

        let first_hash = [21; 32];
        let second_hash = [22; 32];
        let (first_record, _first_bump) = get_document_record_pda(&first_hash);
        let (second_record, _second_bump) = get_document_record_pda(&second_hash);
        assert_ne!(first_record, second_record);

        for (document_hash, document_record) in [(first_hash, first_record), (second_hash, second_record)] {
            let instruction = create_register_document_ix(
                &registrant.pubkey(),
                &document_record,
                document_hash,
            );
            let transaction = Transaction::new_signed_with_payer(
                &[instruction],
                Some(&registrant.pubkey()),
                &[&registrant],
                svm.latest_blockhash(),
            );
            svm.send_transaction(transaction).unwrap();
        }

        assert_eq!(
            deserialize_document_record(&svm, &first_record).document_hash,
            first_hash
        );
        assert_eq!(
            deserialize_document_record(&svm, &second_record).document_hash,
            second_hash
        );
    }

    #[test]
    fn test_register_document_requires_registrant_signature() {
        let mut svm = new_svm();
        let registrant = Keypair::new();
        let fee_payer = Keypair::new();
        svm.airdrop(&fee_payer.pubkey(), 10 * LAMPORTS_PER_SOL)
            .unwrap();

        let document_hash = [31; 32];
        let (document_record, _bump) = get_document_record_pda(&document_hash);
        let instruction =
            create_register_document_ix(&registrant.pubkey(), &document_record, document_hash);
        let mut transaction = Transaction::new_with_payer(
            &[instruction],
            Some(&fee_payer.pubkey()),
        );
        transaction.partial_sign(&[&fee_payer], svm.latest_blockhash());

        let failure = svm.send_transaction(transaction).unwrap_err();
        assert!(
            failure.meta.logs.is_empty(),
            "missing signer should fail before program execution: {failure:?}"
        );
        assert!(svm.get_account(&document_record).is_none());
    }
}
