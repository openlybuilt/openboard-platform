import { Show, SignInButton, UserButton } from '@clerk/react';

export function AuthControls() {
 return <div className="auth-controls">
  <Show when="signed-out"><SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}><button className="auth-sign-in" type="button">Sign in</button></SignInButton></Show>
  <Show when="signed-in"><UserButton /></Show>
 </div>;
}
