import type { ComponentProps } from 'react'
import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createBooking } from '../application/bookings'
import { loadOperationRecords } from '../application/operations'
import type { Session } from '../domain/auth/types'
import { khobraBookingGateway, khobraOperationsGateway } from '../infrastructure/http/khobra-gateways'
import { cardShadow, LoadingState, localDateValue, MessageState, PageHeading, palette, PrimaryButton, SecondaryButton } from './mobile-ui'

export function NewBookingScreen({ session, onCreated, onCancel, onAddAddress }: { session: Session; onCreated: () => void; onCancel: () => void; onAddAddress: () => void }) {
  const [services, setServices] = useState<Array<{ id: string; name: string; baseRate: number; withMaterialsRate: number }>>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; address?: string }>>([])
  const [customerId, setCustomerId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [serviceOptions, setServiceOptions] = useState<Record<string, boolean>>({})
  const [date, setDate] = useState(() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); return localDateValue(tomorrow) })
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('11:00')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      loadOperationRecords(khobraOperationsGateway, 'services', session.token),
      loadOperationRecords(khobraOperationsGateway, 'customers', session.token),
    ])
      .then(([serviceRecords, customerRecords]) => {
        setServices(serviceRecords.map((service) => ({ id: service.id, name: String(service.name || 'Service'), baseRate: Number(service.baseRate || 0), withMaterialsRate: Number(service.withMaterialsRate || service.baseRate || 0) })))
        setCustomers(customerRecords.map(customer => ({ id: customer.id, name: String((customer.user as { name?: string } | undefined)?.name || customer.email || customer.id), address: String((Array.isArray(customer.addresses) ? customer.addresses[0]?.address : '') || customer.address || '') })))
        const customer = customerRecords.find((item) => item.userId === session.user.userId)
        setCustomerId(session.user.role === 'customer' ? customer?.id || '' : '')
        if (session.user.role === 'customer') setAddress(String((Array.isArray(customer?.addresses) ? customer?.addresses[0]?.address : '') || customer?.address || ''))
      })
      .catch((error) => Alert.alert('Could not prepare booking', error instanceof Error ? error.message : 'Try again.'))
      .finally(() => setLoading(false))
  }, [session.token, session.user.userId])

  const submit = async () => {
    try {
      setSubmitting(true)
      await createBooking(khobraBookingGateway, { customerId, serviceIds, serviceOptions: serviceIds.map(serviceId => ({ serviceId, withMaterials: serviceOptions[serviceId] || false })), scheduledDate: date, startTime, endTime, address }, session.token)
      onCreated()
    } catch (error) {
      Alert.alert('Could not create booking', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState label="Preparing your booking..." />
  if (session.user.role === 'customer' && !customerId) return <MessageState icon="person-circle-outline" title="Customer account required" detail="Your customer profile could not be found." action={<SecondaryButton label="Back to bookings" icon="arrow-back" onPress={onCancel} />} />
  if (session.user.role === 'customer' && !address) return <MessageState icon="location-outline" title="Add your primary address" detail="A primary address is required before you can create a booking." action={<PrimaryButton label="Add address in Profile" icon="person-outline" onPress={onAddAddress} />} />

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
    <PageHeading title="New booking" subtitle="Choose a service, time, and location." action={<Pressable accessibilityLabel="Close booking form" onPress={onCancel} style={styles.close}><Ionicons name="close" size={22} color={palette.inkSoft} /></Pressable>} />

    {session.user.role === 'admin' ? <View style={styles.section}><View style={styles.sectionTitle}><View style={styles.step}><Text style={styles.stepText}>1</Text></View><View><Text style={styles.sectionHeading}>Choose a customer</Text><Text style={styles.sectionHint}>The booking will be created for this customer.</Text></View></View><View style={styles.services}>{customers.map(customer => <Pressable accessibilityRole="radio" accessibilityState={{ selected: customer.id === customerId }} key={customer.id} onPress={() => setCustomerId(customer.id)} style={[styles.service, customer.id === customerId && styles.selectedService]}><Ionicons name="person-outline" size={19} color={customer.id === customerId ? '#fff' : palette.primary} /><Text style={[styles.serviceText, customer.id === customerId && styles.selectedText]}>{customer.name}</Text></Pressable>)}</View></View> : null}

    <View style={styles.section}>
      <View style={styles.sectionTitle}><View style={styles.step}><Text style={styles.stepText}>{session.user.role === 'admin' ? '2' : '1'}</Text></View><View><Text style={styles.sectionHeading}>Choose a service</Text><Text style={styles.sectionHint}>Select the cleaning service you need.</Text></View></View>
      <View style={styles.services}>{services.map((service) => {
        const selected = serviceIds.includes(service.id)
        return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={service.id} onPress={() => { setServiceIds(current => selected ? current.filter(id => id !== service.id) : [...current, service.id]); setServiceOptions(current => { const next = { ...current }; if (selected) delete next[service.id]; else next[service.id] = false; return next }) }} style={[styles.service, selected && styles.selectedService]}>
          <View style={[styles.serviceIcon, selected && styles.selectedServiceIcon]}><Ionicons name="sparkles-outline" size={19} color={selected ? '#fff' : palette.primary} /></View>
          <Text style={[styles.serviceText, selected && styles.selectedText]}>{service.name}</Text>
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? '#fff' : '#a8bbb2'} />
        </Pressable>
      })}</View>
      {serviceIds.map(serviceId => { const service = services.find(item => item.id === serviceId)!; return <View key={serviceId} style={styles.variantBlock}><Text style={styles.variantTitle}>{service.name} option</Text><View style={styles.variantRow}><Pressable accessibilityRole="radio" accessibilityState={{ selected: !serviceOptions[serviceId] }} onPress={() => setServiceOptions(current => ({ ...current, [serviceId]: false }))} style={[styles.variant, !serviceOptions[serviceId] && styles.variantSelected]}><Text style={[styles.variantText, !serviceOptions[serviceId] && styles.variantTextSelected]}>Without materials</Text><Text style={[styles.variantPrice, !serviceOptions[serviceId] && styles.variantTextSelected]}>AED {service.baseRate}/hr</Text></Pressable><Pressable accessibilityRole="radio" accessibilityState={{ selected: serviceOptions[serviceId] }} onPress={() => setServiceOptions(current => ({ ...current, [serviceId]: true }))} style={[styles.variant, serviceOptions[serviceId] && styles.variantSelected]}><Text style={[styles.variantText, serviceOptions[serviceId] && styles.variantTextSelected]}>With materials</Text><Text style={[styles.variantPrice, serviceOptions[serviceId] && styles.variantTextSelected]}>AED {service.withMaterialsRate}/hr</Text></Pressable></View></View> })}
    </View>

    <View style={styles.section}>
      <View style={styles.sectionTitle}><View style={styles.step}><Text style={styles.stepText}>{session.user.role === 'admin' ? '3' : '2'}</Text></View><View><Text style={styles.sectionHeading}>Date and time</Text><Text style={styles.sectionHint}>Use local date and 24-hour time.</Text></View></View>
      <Field label="Service date" icon="calendar-outline" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      <View style={styles.row}>
        <View style={styles.half}><Field label="Start" icon="time-outline" value={startTime} onChangeText={setStartTime} placeholder="09:00" /></View>
        <View style={styles.half}><Field label="End" icon="time-outline" value={endTime} onChangeText={setEndTime} placeholder="11:00" /></View>
      </View>
    </View>

    <View style={styles.section}>
      <View style={styles.sectionTitle}><View style={styles.step}><Text style={styles.stepText}>{session.user.role === 'admin' ? '4' : '3'}</Text></View><View><Text style={styles.sectionHeading}>Service address</Text><Text style={styles.sectionHint}>Tell the team where to arrive.</Text></View></View>
      <Field label="Address" icon="location-outline" value={address} onChangeText={setAddress} editable={session.user.role !== 'customer'} placeholder="Building, street, apartment" autoComplete="street-address" />
    </View>

    <PrimaryButton label="Confirm booking" icon="checkmark" onPress={submit} loading={submitting} disabled={!customerId || serviceIds.length === 0} />
    <SecondaryButton label="Cancel" onPress={onCancel} />
  </ScrollView>
}

type FieldProps = ComponentProps<typeof TextInput> & { label: string; icon: ComponentProps<typeof Ionicons>['name'] }

function Field({ label, icon, ...props }: FieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}><Ionicons name={icon} size={18} color={palette.muted} /><TextInput {...props} placeholderTextColor="#91a39b" selectionColor={palette.primary} style={styles.input} /></View></View>
}

const styles = StyleSheet.create({
  form: { padding: 20, paddingBottom: 110, gap: 15 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  section: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 20, padding: 17, gap: 14, ...cardShadow },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  step: { width: 34, height: 34, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: palette.primaryDark, fontWeight: '800' },
  sectionHeading: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  sectionHint: { color: palette.muted, fontSize: 12, marginTop: 2 },
  services: { gap: 9 },
  service: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: palette.border, borderRadius: 15, padding: 10, backgroundColor: '#fbfdfc' },
  selectedService: { backgroundColor: palette.primary, borderColor: palette.primary },
  serviceIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  selectedServiceIcon: { backgroundColor: '#ffffff26' },
  serviceText: { flex: 1, color: palette.ink, fontWeight: '600' },
  selectedText: { color: '#fff', fontWeight: '700' },
  variantBlock: { gap: 7, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  variantTitle: { color: palette.inkSoft, fontSize: 12, fontWeight: '700' },
  variantRow: { flexDirection: 'row', gap: 8 },
  variant: { flex: 1, minHeight: 64, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 13, padding: 10, backgroundColor: '#fbfdfc' },
  variantSelected: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  variantText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  variantPrice: { color: palette.muted, fontSize: 12, marginTop: 3 },
  variantTextSelected: { color: palette.primaryDark },
  field: { gap: 7 },
  label: { color: palette.inkSoft, fontSize: 14, fontWeight: '700' },
  inputWrap: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#ccdad4', backgroundColor: '#fbfdfc', borderRadius: 13, paddingHorizontal: 13 },
  input: { flex: 1, color: palette.ink, fontSize: 14, height: '100%' },
  row: { gap: 12 },
  half: { flex: 1 },
})
