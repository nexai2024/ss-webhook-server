import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteWebhooksBatch, updateWebhooksStatusBatch, exportWebhooksBatch } from "./actions";

// Mock @clerk/nextjs/server
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({
    userId: "user_test_123",
    has: () => true,
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock MongoDB
const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 2 });
const mockDeleteMany = vi.fn().mockResolvedValue({ deletedCount: 2 });
const mockToArray = vi.fn().mockResolvedValue([
  { _id: "id-1", slug: "slug-1", userId: "user_test_123", name: "Webhook 1" },
  { _id: "id-2", slug: "slug-2", userId: "user_test_123", name: "Webhook 2" },
]);
const mockFind = vi.fn().mockReturnValue({
  toArray: mockToArray,
});

const mockDb = {
  collection: vi.fn().mockReturnValue({
    find: mockFind,
    deleteMany: mockDeleteMany,
    updateMany: mockUpdateMany,
  }),
};

vi.mock("./mongodb", () => {
  return {
    default: Promise.resolve({
      db: () => mockDb,
    }),
  };
});

describe("Server Actions - Advanced Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should bulk update webhook statuses", async () => {
    const result = await updateWebhooksStatusBatch(["slug-1", "slug-2"], 201);
    expect(result).toEqual({ data: "Updated status to 201 for 2 endpoints." });
    expect(mockDb.collection).toHaveBeenCalledWith("webhooks");
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { slug: { $in: ["slug-1", "slug-2"] }, userId: "user_test_123" },
      { $set: { status: 201 } }
    );
  });

  it("should bulk delete webhooks and logs", async () => {
    const result = await deleteWebhooksBatch(["slug-1", "slug-2"]);
    expect(result).toEqual({ data: "Successfully deleted 2 endpoints." });
    expect(mockDb.collection).toHaveBeenCalledWith("webhooks");
    expect(mockDb.collection).toHaveBeenCalledWith("logs");
    expect(mockDeleteMany).toHaveBeenCalled();
  });

  it("should export webhooks config as JSON", async () => {
    const result = await exportWebhooksBatch(["slug-1", "slug-2"]);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Webhook 1");
    expect(result[1].name).toBe("Webhook 2");
  });
});
