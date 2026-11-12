import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateEventSettingsDto } from "./updateEventSettingsDto";

describe("UpdateEventSettingsDto tournamentAdvancementLimit", () => {
  const errorsFor = (tournamentAdvancementLimit: unknown) =>
    validate(
      plainToInstance(UpdateEventSettingsDto, { tournamentAdvancementLimit }),
    );

  it.each([undefined, null, 2, 8, 256])("accepts %s", async (limit) => {
    expect(await errorsFor(limit)).toHaveLength(0);
  });

  it.each([0, 1, 3, 10, 512, "8"])("rejects %s", async (limit) => {
    expect(await errorsFor(limit)).toHaveLength(1);
  });
});
