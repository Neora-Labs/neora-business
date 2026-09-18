export interface DatasetRegistration { checksum: string; sourceId: string; rawUri: string }
export interface DatasetRegistrationResult extends DatasetRegistration { id: string; duplicate: boolean }

export class InMemoryImportRepository {
  readonly #datasets = new Map<string, DatasetRegistrationResult>();
  register(input: DatasetRegistration): DatasetRegistrationResult {
    const existing = this.#datasets.get(input.checksum);
    if (existing) return { ...existing, duplicate: true };
    const created = { ...input, id: `dataset-${this.#datasets.size + 1}`, duplicate: false };
    this.#datasets.set(input.checksum, created);
    return created;
  }
  count(): number { return this.#datasets.size; }
}
