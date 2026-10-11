import { describeRequestError } from "./errors";

// An axios error carries the whole request — including Authorization, X-Venue-Access-Token, X-Venue-Password and
// X-Match-Access-Token in config.headers. Logging it puts those in the browser console.
const axiosError = (status?: number, data?: object) =>
  Object.assign(new Error(status ? `Request failed with status code ${status}` : "Network Error"), {
    isAxiosError: true,
    config: {
      url: "/venue/v1/matches/m1/score",
      headers: {
        Authorization: "Bearer jwt-secret",
        "X-Venue-Access-Token": "qr-secret",
        "X-Venue-Password": "court-secret",
        "X-Match-Access-Token": "match-secret",
      },
      data: '{"password":"court-secret"}',
    },
    request: { _header: "X-Venue-Password: court-secret" },
    response: status ? { status, data, headers: {}, config: { headers: { "X-Venue-Password": "court-secret" } } } : undefined,
  });

const SECRETS = ["jwt-secret", "qr-secret", "court-secret", "match-secret"];

it("describes a refused request by status, reason and message only", () => {
  const text = describeRequestError(axiosError(403, { success: false, reason: "wrong-password", message: "Incorrect password." }));

  expect(text).toBe("HTTP 403 wrong-password: Incorrect password.");
  SECRETS.forEach((secret) => expect(text).not.toContain(secret));
});

it("describes a network failure by its message", () => {
  expect(describeRequestError(axiosError())).toBe("Network Error");
});

it("describes a server error without a body", () => {
  expect(describeRequestError(axiosError(500))).toBe("HTTP 500");
});

it("describes anything else by its message", () => {
  expect(describeRequestError(new Error("refused"))).toBe("refused");
  expect(describeRequestError("boom")).toBe("boom");
  expect(describeRequestError(undefined)).toBe("Unknown error");
});
