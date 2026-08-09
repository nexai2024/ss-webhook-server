import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Simple UI test simulating our playground tab layout
function WebhookPlayground({ slug, defaultBody, onSend }: { slug: string; defaultBody: string; onSend: (body: string) => void }) {
  const [body, setBody] = React.useState(defaultBody);
  return (
    <div className="p-4 bg-slate-900 rounded-xl">
      <h3 data-testid="title">Playground: {slug}</h3>
      <textarea
        data-testid="payload-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button data-testid="send-btn" onClick={() => onSend(body)}>
        Trigger Playground Webhook
      </button>
    </div>
  );
}

describe("WebhookPlayground Component", () => {
  it("should render correct header and payload input", () => {
    const handleSend = vi.fn();
    render(<WebhookPlayground slug="test-slug" defaultBody='{"test": true}' onSend={handleSend} />);

    expect(screen.getByTestId("title").textContent).toBe("Playground: test-slug");
    expect(screen.getByTestId("payload-input")).toHaveValue('{"test": true}');
  });

  it("should trigger callback with correct body on button click", () => {
    const handleSend = vi.fn();
    render(<WebhookPlayground slug="test-slug" defaultBody='{"test": true}' onSend={handleSend} />);

    fireEvent.change(screen.getByTestId("payload-input"), { target: { value: '{"modified": true}' } });
    fireEvent.click(screen.getByTestId("send-btn"));

    expect(handleSend).toHaveBeenCalledWith('{"modified": true}');
  });
});
