import { RepositoryActivityCache } from "./repository-activity-cache";

describe("RepositoryActivityCache", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reuses confirmed statuses and asks again for unknown ones", async () => {
    const cache = new RepositoryActivityCache();
    const fetchActivity = jest
      .fn()
      .mockResolvedValueOnce([
        { repositoryName: "idle", status: "inactive" },
        { repositoryName: "broken", status: "unknown" },
      ])
      .mockResolvedValueOnce([{ repositoryName: "broken", status: "active" }]);

    await cache.get("event", "org", ["idle", "broken"], fetchActivity);
    const statuses = await cache.get(
      "event",
      "org",
      ["idle", "broken"],
      fetchActivity,
    );

    expect(fetchActivity).toHaveBeenLastCalledWith(["broken"]);
    expect(statuses.get("idle")).toBe("inactive");
    expect(statuses.get("broken")).toBe("active");
  });

  it("checks again once a status expires", async () => {
    const cache = new RepositoryActivityCache();
    const now = jest.spyOn(Date, "now").mockReturnValue(0);
    const fetchActivity = jest
      .fn()
      .mockResolvedValue([{ repositoryName: "idle", status: "inactive" }]);

    await cache.get("event", "org", ["idle"], fetchActivity);
    now.mockReturnValue(29999);
    await cache.get("event", "org", ["idle"], fetchActivity);
    expect(fetchActivity).toHaveBeenCalledTimes(1);

    now.mockReturnValue(30000);
    await cache.get("event", "org", ["idle"], fetchActivity);
    expect(fetchActivity).toHaveBeenCalledTimes(2);
  });

  it("starts the reuse window when a slow check finishes", async () => {
    const cache = new RepositoryActivityCache();
    const now = jest.spyOn(Date, "now").mockReturnValue(0);
    const fetchActivity = jest.fn().mockImplementation(async () => {
      now.mockReturnValue(60000);
      return [{ repositoryName: "idle", status: "inactive" }];
    });

    await cache.get("event", "org", ["idle"], fetchActivity);
    await cache.get("event", "org", ["idle"], fetchActivity);

    expect(fetchActivity).toHaveBeenCalledTimes(1);
  });

  it("does not reuse results after the organization changes", async () => {
    const cache = new RepositoryActivityCache();
    const fetchActivity = jest
      .fn()
      .mockResolvedValue([{ repositoryName: "idle", status: "inactive" }]);

    await cache.get("event", "old-org", ["idle"], fetchActivity);
    await cache.get("event", "new-org", ["idle"], fetchActivity);

    expect(fetchActivity).toHaveBeenCalledTimes(2);
  });

  it("shares one running check between concurrent callers", async () => {
    const cache = new RepositoryActivityCache();
    const fetchActivity = jest
      .fn()
      .mockResolvedValue([{ repositoryName: "idle", status: "inactive" }]);

    const results = await Promise.all([
      cache.get("event", "org", ["idle"], fetchActivity),
      cache.get("event", "org", ["idle"], fetchActivity),
      cache.get("event", "org", ["idle"], fetchActivity),
    ]);

    expect(fetchActivity).toHaveBeenCalledTimes(1);
    for (const statuses of results)
      expect(statuses.get("idle")).toBe("inactive");
  });

  it("keeps events apart and recovers after a failed check", async () => {
    const cache = new RepositoryActivityCache();
    const fetchActivity = jest
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue([{ repositoryName: "idle", status: "inactive" }]);

    await expect(
      cache.get("a", "org", ["idle"], fetchActivity),
    ).rejects.toThrow("timeout");
    await cache.get("a", "org", ["idle"], fetchActivity);
    await cache.get("b", "org", ["idle"], fetchActivity);

    expect(fetchActivity).toHaveBeenCalledTimes(3);
  });
});
