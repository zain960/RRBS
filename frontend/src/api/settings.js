import client from './client'

export async function getTaxSettings() {
  const { data } = await client.get('/settings/tax')
  return data.data
}

export async function updateTaxSettings({ roomTaxRate, foodTaxRate }) {
  const { data } = await client.put('/settings/tax', {
    room_tax_rate: roomTaxRate,
    food_tax_rate: foodTaxRate,
  })
  return data.data
}
