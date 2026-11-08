/**
 * Stand-in for the customer's own systems. A real server looks the caller up in its CRM or billing system.
 */
export interface Account {
  last4: string;
  zip: string;
  name: string;
  balance: number;
  minMonthlyPayment: number;
}

const ACCOUNTS: Account[] = [
  { last4: '4321', zip: '02139', name: 'Jordan Lee', balance: 1240.5, minMonthlyPayment: 50 },
];

export function findAccount(last4: string, zip: string): Account | undefined {
  return ACCOUNTS.find((a) => a.last4 === last4 && a.zip === zip);
}
