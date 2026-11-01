/// <reference types="jest" />

import { isSimulatedRepository } from "./simulated-repository";

describe("isSimulatedRepository", () => {
  it("simulates sim-* repositories in development", () => {
    expect(isSimulatedRepository("sim-123", "development")).toBe(true);
  });

  it.each(["production", "test", undefined, "develop"])(
    "never simulates when NODE_ENV is %s",
    (nodeEnv) => {
      expect(isSimulatedRepository("sim-123", nodeEnv)).toBe(false);
    },
  );

  it.each(["event-team-123", "a-sim-123", "", undefined])(
    "does not simulate %s",
    (name) => {
      expect(isSimulatedRepository(name, "development")).toBe(false);
    },
  );
});
