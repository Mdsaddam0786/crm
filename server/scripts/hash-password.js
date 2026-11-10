// Usage: npm run hash-password -- <username> <role: admin|viewer> <password>
// Prints an APP_USERS entry. Never commit real passwords.
import bcrypt from 'bcryptjs';

const [username, role, password] = process.argv.slice(2);
if (!username || !['admin', 'viewer'].includes(role) || !password) {
  console.error('Usage: npm run hash-password -- <username> <admin|viewer> <password>');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Use a password of at least 10 characters.');
  process.exit(1);
}
console.log(`${username.toLowerCase()}:${role}:${bcrypt.hashSync(password, 12)}`);
console.log('\nAdd this to APP_USERS in .env (separate multiple users with ";").');
