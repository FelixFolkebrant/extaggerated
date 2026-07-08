import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExtaggeratedView } from "./ExtaggeratedView";

interface MountExtaggeratedViewOptions {
  container: HTMLElement;
  hasApiKey: boolean;
  model: string;
}

export function mountExtaggeratedView({
  container,
  hasApiKey,
  model
}: MountExtaggeratedViewOptions): Root {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <ExtaggeratedView hasApiKey={hasApiKey} model={model} />
    </StrictMode>
  );
  return root;
}
