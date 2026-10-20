import { BadRequestException } from "@nestjs/common";
import { normalizeStreamUrl } from "./event.service";

jest.mock("../team/team.service", () => ({ TeamService: class {} }));

describe("normalizeStreamUrl", () => {
  it("clears the stream link for empty input", () => {
    expect(normalizeStreamUrl(undefined)).toBeNull();
    expect(normalizeStreamUrl("   ")).toBeNull();
  });

  it("accepts http(s) URLs and stores them as entered", () => {
    expect(normalizeStreamUrl("https://youtube.com")).toBe(
      "https://youtube.com",
    );
    expect(normalizeStreamUrl(" https://youtube.com/live/abc ")).toBe(
      "https://youtube.com/live/abc",
    );
  });

  it("rejects malformed and non-http URLs", () => {
    expect(() => normalizeStreamUrl("not a url")).toThrow(BadRequestException);
    expect(() => normalizeStreamUrl("javascript:alert(1)")).toThrow(
      BadRequestException,
    );
  });
});
