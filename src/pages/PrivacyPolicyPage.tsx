import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="bg-black min-h-screen text-[#fafafa] antialiased">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[#737373] hover:text-[#fafafa] transition-colors cursor-pointer mb-12"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-3xl sm:text-4xl font-light tracking-tight mb-3">Privacy Policy</h1>
        <p className="text-sm text-[#737373] mb-12">Last updated: April 7, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-[#a6a6a6]">
          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">1. Information We Collect</h2>
            <p className="mb-2">We collect information that you provide directly to us when using the Platform:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-[#e5e5e5]">Account Information:</strong> Name, email address, profile picture, and authentication credentials</li>
              <li><strong className="text-[#e5e5e5]">Profile Data:</strong> Skills, work history, portfolio items, bio, social links, and other professional details</li>
              <li><strong className="text-[#e5e5e5]">Communications:</strong> Messages exchanged through the Platform's messaging system</li>
              <li><strong className="text-[#e5e5e5]">Transaction Data:</strong> Wallet addresses, escrow transactions, and payment history</li>
              <li><strong className="text-[#e5e5e5]">Usage Data:</strong> Information about how you interact with the Platform, including pages visited, features used, and session duration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">2. How We Use Your Information</h2>
            <p className="mb-2">We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve the Platform</li>
              <li>Match clients with freelancers using our AI-powered matching system</li>
              <li>Facilitate escrow transactions and payments</li>
              <li>Send verification codes, account notifications, and service updates</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">3. Information Sharing</h2>
            <p className="mb-2">We do not sell your personal information. We may share your information in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-[#e5e5e5]">With Other Users:</strong> Your profile information is visible to other users as necessary for the Platform's functionality (e.g., freelancer profiles visible to clients)</li>
              <li><strong className="text-[#e5e5e5]">Service Providers:</strong> We use third-party services including Firebase (authentication), Neon (database), Resend (email), OpenAI (AI features), and Alchemy (blockchain). These providers process data only as necessary to provide their services</li>
              <li><strong className="text-[#e5e5e5]">Legal Requirements:</strong> When required by law, subpoena, or other legal process</li>
              <li><strong className="text-[#e5e5e5]">Blockchain:</strong> Escrow transactions are recorded on the public Ethereum blockchain and are inherently public and permanent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">4. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your personal information. Passwords are hashed using bcrypt, communications are encrypted in transit via TLS, and access to user data is restricted to authorized services. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">5. Blockchain Data</h2>
            <p>When you use escrow features, your wallet address and transaction details are recorded on the public Ethereum blockchain. This data is permanent, publicly accessible, and cannot be deleted or modified by Sifter. Please be aware that your wallet address may be linked to your identity if associated with your Sifter profile.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">6. Data Retention</h2>
            <p>We retain your personal information for as long as your account is active or as needed to provide services. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law or for legitimate business purposes (e.g., dispute resolution). Blockchain data cannot be deleted.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">7. Your Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and personal data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for data processing where applicable</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:privacy@usesifter.com" className="text-[#fafafa] underline decoration-white/20 underline-offset-2 hover:decoration-white/40 transition-all">privacy@usesifter.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">8. Cookies and Tracking</h2>
            <p>The Platform uses local storage to maintain your session and preferences. We do not use third-party tracking cookies or advertising trackers. Analytics data, if collected, is used solely for improving the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">9. Children's Privacy</h2>
            <p>The Platform is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we become aware that a user is under 18, we will take steps to delete their account and information.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Platform. Your continued use of the Platform after changes are posted constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">11. Contact</h2>
            <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:privacy@usesifter.com" className="text-[#fafafa] underline decoration-white/20 underline-offset-2 hover:decoration-white/40 transition-all">privacy@usesifter.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
