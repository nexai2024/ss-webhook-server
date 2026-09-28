import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OnboardingGuide } from "./onboarding-guide";

describe("OnboardingGuide Component", () => {
  it("renders minimized banner when isOpen is false", () => {
    const handleToggle = vi.fn();
    render(
      <OnboardingGuide
        endpointsCount={0}
        totalLogsCount={0}
        hasSelectedEndpoint={false}
        activeTab="logs"
        isOpen={false}
        onToggleOpen={handleToggle}
      />
    );

    expect(screen.getByText("Getting Started Guide")).toBeInTheDocument();
    expect(screen.getByText("Open Guide")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Open Guide"));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("renders full interactive guide when isOpen is true", () => {
    const handleToggle = vi.fn();
    render(
      <OnboardingGuide
        endpointsCount={0}
        totalLogsCount={0}
        hasSelectedEndpoint={false}
        activeTab="logs"
        isOpen={true}
        onToggleOpen={handleToggle}
      />
    );

    expect(screen.getByText("Interactive Getting Started Guide")).toBeInTheDocument();
    expect(screen.getAllByText("1. Create Your First Endpoint").length).toBeGreaterThan(0);
    expect(screen.getByText("2. Trigger a Test Request")).toBeInTheDocument();
    expect(screen.getByText("3. Inspect Captured Logs")).toBeInTheDocument();
    expect(screen.getByText("4. Interactive Playground & White-Label Portal")).toBeInTheDocument();
  });

  it("calculates progress percent correctly based on completed state", () => {
    render(
      <OnboardingGuide
        endpointsCount={2}
        totalLogsCount={5}
        hasSelectedEndpoint={true}
        activeTab="playground"
        isOpen={true}
        onToggleOpen={vi.fn()}
      />
    );

    // All 4 steps should be detected as completed -> 100%
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("triggers interactive action callbacks", () => {
    const handleDemoFill = vi.fn();
    const handleTestWebhook = vi.fn();
    const handleSwitchTab = vi.fn();

    render(
      <OnboardingGuide
        endpointsCount={0}
        totalLogsCount={0}
        hasSelectedEndpoint={false}
        activeTab="logs"
        onDemoFill={handleDemoFill}
        onTestWebhook={handleTestWebhook}
        onSwitchTab={handleSwitchTab}
        isOpen={true}
        onToggleOpen={vi.fn()}
      />
    );

    // Step 1 active action
    const demoBtn = screen.getByText("Auto-Fill Demo Endpoint");
    fireEvent.click(demoBtn);
    expect(handleDemoFill).toHaveBeenCalledTimes(1);

    // Switch to step 2 tab button
    const step2Tab = screen.getByText("2. Trigger a Test Request");
    fireEvent.click(step2Tab);

    const testBtn = screen.getByText("Send Quick Test Request");
    fireEvent.click(testBtn);
    expect(handleTestWebhook).toHaveBeenCalledTimes(1);

    // Switch to step 4 tab button
    const step4Tab = screen.getByText("4. Interactive Playground & White-Label Portal");
    fireEvent.click(step4Tab);

    const pgBtn = screen.getByText("Open Interactive Playground");
    fireEvent.click(pgBtn);
    expect(handleSwitchTab).toHaveBeenCalledWith("playground");

    const portalBtn = screen.getByText("Embed Customer Portal");
    fireEvent.click(portalBtn);
    expect(handleSwitchTab).toHaveBeenCalledWith("portal");
  });

  it("allows marking step done manually and navigating steps", () => {
    render(
      <OnboardingGuide
        endpointsCount={0}
        totalLogsCount={0}
        hasSelectedEndpoint={false}
        activeTab="logs"
        isOpen={true}
        onToggleOpen={vi.fn()}
      />
    );

    const markDoneBtn = screen.getByText("Mark Done");
    fireEvent.click(markDoneBtn);

    expect(screen.getByText("Mark Incomplete")).toBeInTheDocument();

    const nextBtn = screen.getByText("Next Step");
    fireEvent.click(nextBtn);

    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
  });
});
