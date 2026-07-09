import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExtaggeratedView } from "./ExtaggeratedView";
import type { FreshnessStatus } from "../freshness";

export interface ExtaggeratedViewState {
	hasApiKey: boolean;
	freshnessStatus: FreshnessStatus;
	model: string;
	onInitializeTagging: () => void;
}

interface MountExtaggeratedViewOptions extends ExtaggeratedViewState {
	container: HTMLElement;
}

export function mountExtaggeratedView({
	container,
	...state
}: MountExtaggeratedViewOptions): Root {
	const root = createRoot(container);
	renderExtaggeratedView(root, state);
	return root;
}

export function renderExtaggeratedView(
	root: Root,
	{
		freshnessStatus,
		hasApiKey,
		model,
		onInitializeTagging,
	}: ExtaggeratedViewState,
): void {
	root.render(
		<StrictMode>
			<ExtaggeratedView
				freshnessStatus={freshnessStatus}
				hasApiKey={hasApiKey}
				model={model}
				onInitializeTagging={onInitializeTagging}
			/>
		</StrictMode>,
	);
}
