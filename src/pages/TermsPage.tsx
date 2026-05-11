import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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

        <h1 className="text-3xl sm:text-4xl font-light tracking-tight mb-3">Terms of Service</h1>
        <p className="text-sm text-[#737373] mb-12">Last updated: April 7, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-[#a6a6a6]">
          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using UseSifter ("Sifter", "we", "our", or the "Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the Platform. These terms constitute a legally binding agreement between you and Sifter.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">2. Description of Service</h2>
            <p>Sifter is a freelancing platform that connects clients with freelance professionals. The Platform provides tools for project matching via AI, secure escrow payments powered by blockchain technology, real-time communication, and project management. Sifter acts as an intermediary platform and is not a party to agreements between clients and freelancers.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">3. Account Registration</h2>
            <p className="mb-2">To use the Platform, you must create an account by providing accurate and complete information. You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
              <li>Ensuring that your account information remains accurate and up-to-date</li>
            </ul>
            <p className="mt-2">You must be at least 18 years old to create an account. Each person may only maintain one account.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">4. Escrow and Payments</h2>
            <p className="mb-2">Sifter utilizes blockchain-based smart contracts for escrow functionality. By using the escrow features, you acknowledge and agree that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Funds are held in smart contracts on the blockchain and are governed by the contract logic</li>
              <li>Sifter does not have custody of escrowed funds once they are deposited into a smart contract</li>
              <li>Transaction fees and gas costs are your responsibility</li>
              <li>Blockchain transactions are irreversible once confirmed</li>
              <li>Auto-release mechanisms will execute automatically based on the agreed-upon terms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">5. User Conduct</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable laws</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Interfere with or disrupt the Platform's infrastructure</li>
              <li>Attempt to gain unauthorized access to any part of the Platform</li>
              <li>Submit false, misleading, or fraudulent information in profiles or proposals</li>
              <li>Harass, abuse, or threaten other users</li>
              <li>Circumvent the Platform's payment or escrow system</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">6. Intellectual Property</h2>
            <p>All content, features, and functionality of the Platform are owned by Sifter and are protected by copyright, trademark, and other intellectual property laws. Work product created during engagements facilitated through the Platform is governed by the agreement between the client and freelancer. Sifter does not claim ownership of work products created by users.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">7. Dispute Resolution</h2>
            <p>The Platform provides built-in dispute mechanisms through smart contracts. In the event of a dispute between a client and freelancer, the designated arbitrator will review the case. Sifter is not responsible for the outcome of disputes and does not guarantee any particular resolution. Dispute timeouts are enforced automatically by the smart contract.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Sifter shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the Platform. Sifter is not liable for losses resulting from blockchain transactions, smart contract execution, wallet security, or cryptocurrency price fluctuations.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">9. Disclaimers</h2>
            <p>The Platform is provided "as is" and "as available" without warranties of any kind. We do not guarantee the quality of work provided by freelancers, the reliability of clients, or the uninterrupted availability of the Platform. Users engage with each other at their own risk.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">10. Termination</h2>
            <p>We reserve the right to suspend or terminate your account at any time for violation of these terms or for any other reason at our sole discretion. Upon termination, any pending escrow transactions will be handled according to the smart contract terms. You may delete your account at any time through the Platform settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">11. Changes to Terms</h2>
            <p>We may update these Terms of Service from time to time. We will notify users of material changes by posting the updated terms on the Platform. Your continued use of the Platform after changes are posted constitutes acceptance of the revised terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-[#fafafa] mb-3">12. Contact</h2>
            <p>If you have questions about these Terms of Service, please contact us at <a href="mailto:support@usesifter.com" className="text-[#fafafa] underline decoration-white/20 underline-offset-2 hover:decoration-white/40 transition-all">support@usesifter.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
