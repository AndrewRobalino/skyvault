import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DateInput from "../components/controls/DateInput.jsx";
import SubmitButton from "../components/controls/SubmitButton.jsx";
import TimezoneToggle from "../components/controls/TimezoneToggle.jsx";
import { useObserverStore } from "../stores/observerStore.js";
import { DATE_MIN, DATE_MAX } from "../utils/formatDatetime.js";

describe("date range + zone controls", () => {
  beforeEach(() => {
    useObserverStore.getState().reset();
  });

  it("date picker is bounded to the planet ephemeris window", () => {
    useObserverStore.setState({ date: "2026-09-30" });
    const { container } = render(<DateInput />);
    const input = container.querySelector('input[type="date"]');
    expect(input).toHaveAttribute("min", DATE_MIN);
    expect(input).toHaveAttribute("max", DATE_MAX);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a typed date outside the window explains the limit", () => {
    // min/max do not stop keyboard entry, so the value can still land here.
    useObserverStore.setState({ date: "2060-01-01" });
    render(<DateInput />);
    expect(screen.getByRole("alert")).toHaveTextContent(/1900.*2053/);
  });

  it("GO is disabled for a date outside the window", () => {
    useObserverStore.setState({ rawQuery: "Tokyo", date: "2060-01-01" });
    render(<SubmitButton isGeocoding={false} isComputing={false} />);
    expect(screen.getByRole("button", { name: "GO" })).toBeDisabled();
  });

  it("the Local option names the selected place's zone", () => {
    useObserverStore.setState({
      selected: { lat: 35.69, lon: 139.69, displayName: "Tokyo", timezone: "Asia/Tokyo" },
    });
    render(<TimezoneToggle />);
    expect(screen.getByRole("button", { name: /local/i })).toHaveAttribute(
      "title",
      expect.stringContaining("Asia/Tokyo")
    );
  });

  it("before a place is chosen, Local explains it follows the place", () => {
    render(<TimezoneToggle />);
    expect(screen.getByRole("button", { name: /local/i })).toHaveAttribute(
      "title",
      expect.stringMatching(/place/i)
    );
  });
});
