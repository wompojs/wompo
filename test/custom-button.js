import { html, defineWompo } from 'wompo';

export default function CustomButton({}) {
  return html`<span>TEST</span>`;
}

defineWompo(CustomButton, { extends: 'button', name: 'custom-button' });
