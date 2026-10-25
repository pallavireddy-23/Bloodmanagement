import { test, expect } from "@playwright/test";
async function sample(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer picture." }),
  ).toBeVisible();
}
const nav = (page, name) =>
  page.locator("nav").getByRole("button", { name, exact: false });
test("login, sample dashboard and full request reservation workflow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: false }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "Show password" }).check();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await sample(page);
  await expect(
    page.getByText("Fictional data, saved in this tab only."),
  ).toBeVisible();
  await nav(page, "Requests").click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page
    .getByLabel("Staff compatibility approval reference")
    .fill("DEMO compatibility approved");
  await page
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reserve units", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reserve units", exact: true })
    .click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("cell", { name: "BF-011", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("cell", { name: "BF-012", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Issue units", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm issue", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "issued", exact: true }),
  ).toBeVisible();
  await nav(page, "Activity").click();
  await expect(
    page.getByRole("cell", { name: "issue request", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("create donor, quarantined donation, screening, search and history", async ({
  page,
}) => {
  await sample(page);
  await nav(page, "Donors").click();
  await page.getByRole("button", { name: "+ Add donor" }).click();
  await page.getByLabel("Full name").fill("Test Donor");
  await page.getByLabel("Contact / fictional reference").fill("DEMO-NEW");
  await page.getByLabel("Blood group", { exact: true }).selectOption("AB-");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByLabel("Search records").fill("Test Donor");
  await expect(page.locator("tbody tr:visible")).toHaveCount(1);
  await nav(page, "Inventory").click();
  await page.getByRole("button", { name: "+ Record donation" }).click();
  await page
    .getByLabel("Donor", { exact: true })
    .selectOption({ label: "Test Donor · AB-" });
  await page.getByLabel("Unique unit ID / barcode").fill("TEST-UNIT");
  await page.getByLabel("Collection date and time").fill("2026-01-01T10:00");
  await page.getByLabel("Actual expiry date and time").fill("2030-01-01T10:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "TEST-UNIT" });
  await expect(row.getByText("quarantine", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Review screening" }).click();
  await page
    .getByLabel("Screening note / fictional approval reference")
    .fill("DEMO screening approved");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "TEST-UNIT" })
      .getByText("available", { exact: true }),
  ).toBeVisible();
  await nav(page, "Donors").click();
  await page
    .getByRole("row")
    .filter({ hasText: "Test Donor" })
    .getByRole("button", { name: "View history" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("cell", { name: "TEST-UNIT" }),
  ).toBeVisible();
});
test("requester gets own requests and cannot see staff navigation", async ({
  page,
}) => {
  await sample(page);
  await page.getByLabel("Demo role").selectOption("requester");
  await expect(nav(page, "Inventory")).toHaveCount(0);
  await expect(nav(page, "Accounts")).toHaveCount(0);
  await expect(page.getByText("Registered users", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "+ New request" }).click();
  await page.getByLabel("Fictional patient reference").fill("DEMO-REQUESTER");
  await page.getByLabel("Blood group", { exact: true }).selectOption("AB+");
  await page.getByRole("button", { name: "Submit request" }).click();
  await nav(page, "Requests").click();
  await expect(page.getByText("DEMO-REQUESTER", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
});
test("mobile screens fit and keep sign-out accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav(page, "Inventory").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
