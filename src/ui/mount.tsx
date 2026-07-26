import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	ExtaggeratedView,
	type ExtaggeratedViewProps,
} from "./ExtaggeratedView";

interface MountExtaggeratedViewOptions extends ExtaggeratedViewProps {
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
	state: ExtaggeratedViewProps,
): void {
	root.render(
		<StrictMode>
			<ExtaggeratedView {...state} />
		</StrictMode>,
	);
}
