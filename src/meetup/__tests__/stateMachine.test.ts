import { MeetupPhase } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canChangeQuestion,
  canPause,
  isProgressable,
  isTerminal,
  nextPhaseAfter,
  phaseLabel,
} from "../stateMachine";

describe("nextPhaseAfter", () => {
  it("follows the documented flow order", () => {
    expect(nextPhaseAfter(MeetupPhase.OPENING)).toBe(MeetupPhase.CHECKIN);
    expect(nextPhaseAfter(MeetupPhase.CHECKIN)).toBe(MeetupPhase.ICEBREAKER);
    expect(nextPhaseAfter(MeetupPhase.ICEBREAKER)).toBe(MeetupPhase.INTERACTION);
    expect(nextPhaseAfter(MeetupPhase.INTERACTION)).toBe(MeetupPhase.FREE_TALK);
    expect(nextPhaseAfter(MeetupPhase.FREE_TALK)).toBe(MeetupPhase.CLOSING);
  });

  it("ends the meetup after CLOSING", () => {
    expect(nextPhaseAfter(MeetupPhase.CLOSING)).toBe(MeetupPhase.ENDED);
  });

  it("returns null for non-progressable phases", () => {
    for (const phase of [
      MeetupPhase.SETUP,
      MeetupPhase.READY,
      MeetupPhase.PAUSED,
      MeetupPhase.ENDED,
      MeetupPhase.CANCELLED,
    ]) {
      expect(nextPhaseAfter(phase)).toBeNull();
    }
  });
});

describe("isProgressable", () => {
  it("is true only for the six active flow phases", () => {
    const active = [
      MeetupPhase.OPENING,
      MeetupPhase.CHECKIN,
      MeetupPhase.ICEBREAKER,
      MeetupPhase.INTERACTION,
      MeetupPhase.FREE_TALK,
      MeetupPhase.CLOSING,
    ];
    for (const phase of active) expect(isProgressable(phase)).toBe(true);
    for (const phase of [MeetupPhase.SETUP, MeetupPhase.READY, MeetupPhase.PAUSED, MeetupPhase.ENDED]) {
      expect(isProgressable(phase)).toBe(false);
    }
  });
});

describe("canPause / canChangeQuestion / isTerminal", () => {
  it("canPause matches the active flow phases", () => {
    expect(canPause(MeetupPhase.FREE_TALK)).toBe(true);
    expect(canPause(MeetupPhase.PAUSED)).toBe(false);
    expect(canPause(MeetupPhase.READY)).toBe(false);
  });

  it("canChangeQuestion is only true for ICEBREAKER and INTERACTION", () => {
    expect(canChangeQuestion(MeetupPhase.ICEBREAKER)).toBe(true);
    expect(canChangeQuestion(MeetupPhase.INTERACTION)).toBe(true);
    expect(canChangeQuestion(MeetupPhase.CHECKIN)).toBe(false);
    expect(canChangeQuestion(MeetupPhase.FREE_TALK)).toBe(false);
  });

  it("isTerminal is true only for ENDED and CANCELLED", () => {
    expect(isTerminal(MeetupPhase.ENDED)).toBe(true);
    expect(isTerminal(MeetupPhase.CANCELLED)).toBe(true);
    expect(isTerminal(MeetupPhase.CLOSING)).toBe(false);
  });
});

describe("phaseLabel", () => {
  it("has a Chinese label for every phase", () => {
    for (const phase of Object.values(MeetupPhase)) {
      expect(phaseLabel(phase)).toEqual(expect.any(String));
      expect(phaseLabel(phase).length).toBeGreaterThan(0);
    }
  });
});
