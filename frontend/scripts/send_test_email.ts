import { sendEmail } from '../src/lib/email'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function run() {
  const email = process.argv[2] || 'josorio@matriceconsulting.com'
  console.log(`Sending test email to ${email}...`)
  
  try {
    await sendEmail(
      'verify_email',
      email,
      {
        firstName: 'Prueba Local',
        verifyUrl: 'http://localhost:3000/verify?token=test'
      }
    )
    console.log('Success!')
  } catch (error) {
    console.error('Failed:', error)
  }
}

run()
