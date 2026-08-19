/**
 * Guards against "Failed to execute 'removeChild'/'insertBefore' on 'Node'"
 * crashes. These happen when something outside React's control (browser
 * extensions like Google Translate, Grammarly, or password-manager autofill)
 * mutates a DOM node that React is still tracking, so React's next commit
 * tries to remove/insert a node that's already gone. The node is already
 * detached in that case, so skipping the operation is safe and prevents an
 * otherwise-unrecoverable render crash (caught previously by ErrorBoundary,
 * e.g. on /assignment-zero).
 */
export function installDomErrorGuard() {
  if (typeof Node !== 'function' || !Node.prototype) return;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn('[domErrorGuard] Skipped removeChild: node is not a child of this parent', child, this);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn('[domErrorGuard] Skipped insertBefore: reference node is not a child of this parent', referenceNode, this);
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
