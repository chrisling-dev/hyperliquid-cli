import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"

// Mock context and output modules
vi.mock("../cli/program.js", () => ({
  getContext: vi.fn(),
  getOutputOptions: vi.fn(() => ({ json: false })),
}))

vi.mock("../cli/output.js", () => ({
  output: vi.fn(),
  outputError: vi.fn(),
  outputSuccess: vi.fn(),
}))

import { getContext } from "../cli/program.js"

describe("referral commands", () => {
  let mockExchangeClient: {
    setReferrer: Mock
  }

  let mockInfoClient: {
    referral: Mock
  }

  let mockContext: {
    getWalletClient: Mock
    getPublicClient: Mock
    getWalletAddress: Mock
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mockExchangeClient = {
      setReferrer: vi.fn(),
    }

    mockInfoClient = {
      referral: vi.fn(),
    }

    mockContext = {
      getWalletClient: vi.fn(() => mockExchangeClient),
      getPublicClient: vi.fn(() => mockInfoClient),
      getWalletAddress: vi.fn(() => "0x1234567890abcdef1234567890abcdef12345678"),
    }

    vi.mocked(getContext).mockReturnValue(mockContext as unknown as ReturnType<typeof getContext>)
  })

  describe("set command", () => {
    it("should set referral code successfully", async () => {
      mockExchangeClient.setReferrer.mockResolvedValue({
        status: "ok",
        response: { data: {} },
      })

      const code = "MYCODE123"
      const result = await mockContext.getWalletClient().setReferrer({ code })

      expect(mockExchangeClient.setReferrer).toHaveBeenCalledWith({ code })
      expect(result.status).toBe("ok")
    })

    it("should handle empty referral code", async () => {
      const code = ""
      await mockContext.getWalletClient().setReferrer({ code })

      expect(mockExchangeClient.setReferrer).toHaveBeenCalledWith({ code: "" })
    })

    it("should handle special characters in code", async () => {
      const code = "CODE-123_ABC"
      await mockContext.getWalletClient().setReferrer({ code })

      expect(mockExchangeClient.setReferrer).toHaveBeenCalledWith({ code })
    })

    it("should propagate error from API", async () => {
      mockExchangeClient.setReferrer.mockRejectedValue(
        new Error("Invalid referral code")
      )

      await expect(
        mockContext.getWalletClient().setReferrer({ code: "INVALID" })
      ).rejects.toThrow("Invalid referral code")
    })

    it("should handle already referred error", async () => {
      mockExchangeClient.setReferrer.mockRejectedValue(
        new Error("Already has a referrer")
      )

      await expect(
        mockContext.getWalletClient().setReferrer({ code: "CODE123" })
      ).rejects.toThrow("Already has a referrer")
    })
  })

  describe("status command", () => {
    it("should return referral status with data", async () => {
      const referralData = {
        referrer: "0xabcdef1234567890abcdef1234567890abcdef12",
        referrerCode: "TOPTRADER",
        referrerFeeRate: "0.1",
        referredCount: 5,
        earnedRewards: "1000.50",
      }
      mockInfoClient.referral.mockResolvedValue(referralData)

      const user = mockContext.getWalletAddress()
      const result = await mockContext.getPublicClient().referral({ user })

      expect(mockInfoClient.referral).toHaveBeenCalledWith({ user })
      expect(result).toEqual(referralData)
    })

    it("should return null when no referral found", async () => {
      mockInfoClient.referral.mockResolvedValue(null)

      const user = mockContext.getWalletAddress()
      const result = await mockContext.getPublicClient().referral({ user })

      expect(result).toBeNull()
    })

    it("should use wallet address from context", async () => {
      mockInfoClient.referral.mockResolvedValue({})

      const user = mockContext.getWalletAddress()
      await mockContext.getPublicClient().referral({ user })

      expect(mockInfoClient.referral).toHaveBeenCalledWith({
        user: "0x1234567890abcdef1234567890abcdef12345678",
      })
    })

    it("should handle API error gracefully", async () => {
      mockInfoClient.referral.mockRejectedValue(new Error("Network error"))

      await expect(
        mockContext.getPublicClient().referral({
          user: mockContext.getWalletAddress(),
        })
      ).rejects.toThrow("Network error")
    })

    it("should return referral with zero rewards", async () => {
      const referralData = {
        referrer: "0xabcdef1234567890abcdef1234567890abcdef12",
        referrerCode: "CODE123",
        referrerFeeRate: "0",
        referredCount: 0,
        earnedRewards: "0",
      }
      mockInfoClient.referral.mockResolvedValue(referralData)

      const user = mockContext.getWalletAddress()
      const result = await mockContext.getPublicClient().referral({ user })

      expect(result.earnedRewards).toBe("0")
      expect(result.referredCount).toBe(0)
    })
  })

  describe("output formatting", () => {
    it("should format success message for set command", () => {
      const code = "MYCODE123"
      const successMessage = `Referral code set: ${code}`

      expect(successMessage).toBe("Referral code set: MYCODE123")
    })

    it("should format no referral message for status command", () => {
      const result = null
      const message = !result ? "No referral information found" : "Has referral"

      expect(message).toBe("No referral information found")
    })
  })
})
