import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";

/**
 * 015 US2 (FR-017/FR-018): the artifact store — .pptx files on local disk under a
 * dedicated directory, keyed by an opaque ref the job carries. Files are purged on
 * job failure and by the sweeper once they outlive the retention window. Access
 * control lives in the controller (owner-scoped job lookup resolves the ref);
 * the ref itself is never user-supplied, so no path traversal surface.
 */
/**
 * The artifact-ref convention: one `.pptx` per job id. Single source of truth so the
 * worker (write/cleanup), the timeout sweeper, and the store all derive the same key.
 */
export function pptxArtifactRef(jobId: string): string {
  return `${jobId}.pptx`;
}

export interface PptxArtifactStore {
  write(jobId: string, data: Buffer): Promise<{ artifactRef: string; byteSize: number }>;
  /** Read stream for a previously written artifact, or undefined when purged. */
  read(artifactRef: string): Promise<Readable | undefined>;
  delete(artifactRef: string): Promise<void>;
  /** Removes artifacts older than maxAgeMs (mtime-based); returns removed count. */
  purgeOlderThan(maxAgeMs: number, now?: Date): Promise<number>;
}

export class FsPptxArtifactStore implements PptxArtifactStore {
  constructor(private readonly dir: string) {}

  async write(jobId: string, data: Buffer): Promise<{ artifactRef: string; byteSize: number }> {
    await mkdir(this.dir, { recursive: true });
    const artifactRef = pptxArtifactRef(jobId);
    await writeFile(this.path(artifactRef), data);
    return { artifactRef, byteSize: data.byteLength };
  }

  async read(artifactRef: string): Promise<Readable | undefined> {
    try {
      await stat(this.path(artifactRef));
    } catch {
      return undefined;
    }
    return createReadStream(this.path(artifactRef));
  }

  async delete(artifactRef: string): Promise<void> {
    await rm(this.path(artifactRef), { force: true });
  }

  async purgeOlderThan(maxAgeMs: number, now: Date = new Date()): Promise<number> {
    let removed = 0;
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch {
      return 0; // directory not created yet — nothing to purge
    }
    for (const entry of entries) {
      try {
        const info = await stat(this.path(entry));
        if (now.getTime() - info.mtimeMs >= maxAgeMs) {
          await rm(this.path(entry), { force: true });
          removed += 1;
        }
      } catch {
        // raced with another purge/delete — fine, the goal is "gone".
      }
    }
    return removed;
  }

  private path(artifactRef: string): string {
    return join(this.dir, artifactRef);
  }
}
