import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const registerSw = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js');
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#208AEF" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <script data-register-sw dangerouslySetInnerHTML={{ __html: registerSw }} />
      </body>
    </html>
  );
}
