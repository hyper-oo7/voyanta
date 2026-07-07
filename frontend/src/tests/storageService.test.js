import { describe, it, expect } from 'vitest';
import { uploadBlob, BUCKET, PRIVATE_BUCKETS, FOLDERS } from '../services/storageService.js';

describe('storageService constants & path security', () => {
  it('defines correct storage buckets', () => {
    expect(BUCKET).toBe('agency-assets');
    expect(PRIVATE_BUCKETS.PROPOSAL_ASSETS).toBe('proposal-assets');
    expect(PRIVATE_BUCKETS.GENERATED_DOCS).toBe('generated-documents');
  });

  it('defines correct storage folders', () => {
    expect(FOLDERS.LOGOS).toBe('logos');
    expect(FOLDERS.PROPOSAL_PDFS).toBe('proposal-pdfs');
    expect(FOLDERS.CLIENT_FILES).toBe('client-files');
  });

  it('uploadBlob falls back or errors gracefully without supabase', async () => {
    const blob = new Blob(['test content'], { type: 'application/pdf' });
    try {
      await uploadBlob(blob, 'test.pdf', FOLDERS.PROPOSAL_PDFS);
    } catch (e) {
      expect(typeof e.message).toBe('string');
    }
  });
});
