import React from 'react';

export default function PrivacyPolicy() {
  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Privacy Policy</h1>
      <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>
      
      <h2>1. Introduction</h2>
      <p>
        Fall Labs ("we," "our," or "us") operates the Digital Hymnal mobile application (the "App"). 
        This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our App.
      </p>

      <h2>2. Information Collection and Use</h2>
      <p>
        We do not collect any personally identifiable information. 
        The App functions as a standalone utility. Any preferences or settings (such as text size or dark mode) 
        are stored locally on your device and are never transmitted to our servers.
      </p>

      <h2>3. Third-Party Services</h2>
      <p>
        The App does not use third-party services that collect information used to identify you.
      </p>

      <h2>4. Changes to This Privacy Policy</h2>
      <p>
        We may update our Privacy Policy from time to time. Thus, you are advised to review this page periodically for any changes.
      </p>

      <h2>5. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy, please contact us at: support@falllabs.com
      </p>
    </main>
  );
}