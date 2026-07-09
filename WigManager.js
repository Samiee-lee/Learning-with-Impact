import './globals.css';

export const metadata = {
  title: 'Learning With Impact by Evolution Academy',
  description: 'Learning Impact & Evaluation Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
