import { describe, expect, it } from "vitest";

import {
  clearRepositoryDraft,
  clearSessionDraft,
  clearVacancyDraft,
  deriveRepositoryDraft,
  readRepositoryDraft,
  readSessionDraft,
  readVacancyDraft,
  writeRepositoryDraft,
  writeSessionDraft,
  writeVacancyDraft,
  type RepositoryDraft,
} from "./interview-draft";
import type { InterviewSession } from "./interview-api";

describe("vacancy draft", () => {
  it("writes and reads back a valid draft", () => {
    writeVacancyDraft({ id: "v1", description: "desc" });
    expect(readVacancyDraft()).toEqual({ id: "v1", description: "desc" });
  });

  it("returns null for malformed JSON", () => {
    sessionStorage.setItem("interviewtrail.vacancy", "{not json");
    expect(readVacancyDraft()).toBeNull();
  });

  it("returns null when id or description have the wrong shape", () => {
    sessionStorage.setItem("interviewtrail.vacancy", JSON.stringify({ id: "v1" }));
    expect(readVacancyDraft()).toBeNull();
  });

  it("clearVacancyDraft removes vacancy, repository and session drafts", () => {
    writeVacancyDraft({ id: "v1", description: "desc" });
    writeRepositoryDraft({
      owner: "o",
      name: "n",
      language: "TS",
      fileCount: 1,
      omittedCount: 0,
      topFiles: [],
    });
    writeSessionDraft({ id: "s1" });

    clearVacancyDraft();

    expect(readVacancyDraft()).toBeNull();
    expect(readRepositoryDraft()).toBeNull();
    expect(readSessionDraft()).toBeNull();
  });
});

describe("repository draft", () => {
  const draft: RepositoryDraft = {
    owner: "octo",
    name: "cat",
    language: "TypeScript",
    fileCount: 10,
    omittedCount: 2,
    topFiles: ["a.ts"],
  };

  it("writes and reads back a valid draft", () => {
    writeRepositoryDraft(draft);
    expect(readRepositoryDraft()).toEqual(draft);
  });

  it("returns null when owner or name have the wrong shape", () => {
    sessionStorage.setItem("interviewtrail.repository", JSON.stringify({ owner: "o" }));
    expect(readRepositoryDraft()).toBeNull();
  });

  it("clearRepositoryDraft only removes the repository key", () => {
    writeVacancyDraft({ id: "v1", description: "desc" });
    writeRepositoryDraft(draft);

    clearRepositoryDraft();

    expect(readRepositoryDraft()).toBeNull();
    expect(readVacancyDraft()).not.toBeNull();
  });
});

describe("deriveRepositoryDraft", () => {
  const baseSession: InterviewSession = {
    id: "s1",
    status: "in_progress",
    questions: [],
  } as unknown as InterviewSession;

  it("returns null when session has no repo", () => {
    expect(deriveRepositoryDraft(baseSession)).toBeNull();
  });

  it("splits owner/name from fullName", () => {
    const session = {
      ...baseSession,
      repo: { fullName: "octo/cat", primaryLanguage: "TS" },
      repoAnalysis: { fileCount: 5, omittedCount: 1, topFiles: ["a.ts"] },
    } as unknown as InterviewSession;

    expect(deriveRepositoryDraft(session)).toEqual({
      owner: "octo",
      name: "cat",
      language: "TS",
      fileCount: 5,
      omittedCount: 1,
      topFiles: ["a.ts"],
    });
  });

  it("falls back to the full fullName as the repo name when there is no slash", () => {
    const session = {
      ...baseSession,
      repo: { fullName: "no-owner-repo", primaryLanguage: null },
    } as unknown as InterviewSession;

    const result = deriveRepositoryDraft(session);
    expect(result?.owner).toBe("no-owner-repo");
    expect(result?.name).toBe("no-owner-repo");
  });

  it("defaults repoAnalysis fields when repoAnalysis is absent", () => {
    const session = {
      ...baseSession,
      repo: { fullName: "octo/cat", primaryLanguage: null },
    } as unknown as InterviewSession;

    expect(deriveRepositoryDraft(session)).toEqual({
      owner: "octo",
      name: "cat",
      language: null,
      fileCount: 0,
      omittedCount: 0,
      topFiles: [],
    });
  });
});

describe("session draft", () => {
  it("writes and reads back a valid draft", () => {
    writeSessionDraft({ id: "s1" });
    expect(readSessionDraft()).toEqual({ id: "s1" });
  });

  it("returns null for malformed data", () => {
    sessionStorage.setItem("interviewtrail.session", JSON.stringify({}));
    expect(readSessionDraft()).toBeNull();
  });

  it("clearSessionDraft removes only the session key", () => {
    writeVacancyDraft({ id: "v1", description: "desc" });
    writeSessionDraft({ id: "s1" });

    clearSessionDraft();

    expect(readSessionDraft()).toBeNull();
    expect(readVacancyDraft()).not.toBeNull();
  });
});
