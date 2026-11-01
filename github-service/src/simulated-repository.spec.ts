/// <reference types="jest" />

import { isSimulatedRepository } from "./simulated-repository";

const SIM_REPOSITORY = "sim-0b7e2f4c-3d1a-4e6b-9c8d-2a5f7e1b3c9d";

describe("isSimulatedRepository", () => {
  it.each([
    SIM_REPOSITORY,
    SIM_REPOSITORY.toUpperCase().replace("SIM-", "sim-"),
  ])("simulates %s in development", (name) => {
    expect(isSimulatedRepository(name, "development")).toBe(true);
  });

  it.each(["production", "test", undefined, "develop"])(
    "never simulates when NODE_ENV is %s",
    (nodeEnv) => {
      expect(isSimulatedRepository(SIM_REPOSITORY, nodeEnv)).toBe(false);
    },
  );

  it.each([
    "sim-123",
    "sim-team",
    `sim-cup-Team-${SIM_REPOSITORY.slice(4)}`,
    `${SIM_REPOSITORY}-extra`,
    `a-${SIM_REPOSITORY}`,
    "event-team-123",
    "",
    undefined,
  ])("does not simulate %s", (name) => {
    expect(isSimulatedRepository(name, "development")).toBe(false);
  });
});
