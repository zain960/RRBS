import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BedDouble,
  CalendarPlus,
  CreditCard,
  Globe,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  addPayment,
  confirmBooking,
  createBooking,
  listDurations,
  searchRooms,
} from '../api/bookings'
import { errorDetails, errorMessage } from '../api/client'
import { listRoomTypes } from '../api/roomTypes'
import { getTaxSettings } from '../api/settings'
import CouponField, { PriceBreakdown } from '../components/domain/CouponField'
import PageMeta from '../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DateTimePicker,
  EmptyState,
  Input,
  Radio,
  Select,
  SkeletonCard,
  SkeletonGroup,
  Stepper,
  Textarea,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import cn from '../lib/cn'
import { dateRange, money, toLocalInputValue } from '../lib/format'

/**
 * Guest booking flow (SRS §4.3).
 *
 *   search & select → guest details → review → payment → confirmation
 *
 * The booking row is created at the end of *review*, not at the start: it is
 * held as `Pending` and only moves to `Confirmed` once a payment is recorded
 * (SRS §5.1). That ordering is why review and payment are separate steps —
 * between them the server has locked the price, and the payment step is
 * settling a figure that can no longer move (CLAUDE.md §4).
 */

const STEPS = [
  { key: 'search', label: 'Find a room' },
  { key: 'details', label: 'Your details' },
  { key: 'review', label: 'Review' },
  { key: 'payment', label: 'Payment' },
  { key: 'done', label: 'Confirmed' },
]

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash at the desk', description: 'Settle when you arrive.', icon: Banknote },
  { value: 'CARD', label: 'Card at the desk', description: 'Chip and PIN on arrival.', icon: CreditCard },
  { value: 'ONLINE', label: 'Online transfer', description: 'Recorded against your booking.', icon: Globe },
]

export default function Book() {
  const navigate = useNavigate()
  const toast = useToast()
  const { isAuthenticated, user } = useAuth()
  const [searchParams] = useSearchParams()

  const handedOver = useMemo(
    () => ({
      checkIn: searchParams.get('checkIn'),
      durationId: searchParams.get('durationId'),
      roomTypeId: searchParams.get('roomTypeId') ?? '',
      guests: searchParams.get('guests'),
    }),
    [searchParams]
  )

  const [step, setStep] = useState('search')
  const [durations, setDurations] = useState([])
  const [roomTypes, setRoomTypes] = useState([])

  const [criteria, setCriteria] = useState(() => ({
    checkIn: handedOver.checkIn || toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    durationId: handedOver.durationId || '',
    roomTypeId: handedOver.roomTypeId || '',
    guests: Number(handedOver.guests) || 2,
  }))

  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [searchWindow, setSearchWindow] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [details, setDetails] = useState({
    guestName: '',
    idProofNo: '',
    specialRequests: '',
    couponCode: '',
  })
  const [paymentMethod, setPaymentMethod] = useState('CASH')

  const [booking, setBooking] = useState(null)
  const [couponResult, setCouponResult] = useState(null)
  const [roomTaxRate, setRoomTaxRate] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  // Search results are already priced at the current rate, but the discount
  // moves as the guest types a coupon — so recompute the tax line from the rate.
  const quotedSubtotal = Number(selectedRoom?.pricing.subtotal ?? 0)
  const quotedDiscount = couponResult?.valid ? Number(couponResult.discountAmount) : 0
  const quotedTax = ((quotedSubtotal - quotedDiscount) * roomTaxRate) / 100

  useEffect(() => {
    listDurations()
      .then((list) => {
        setDurations(list)
        setCriteria((current) => ({
          ...current,
          durationId: current.durationId || String(list[0]?.id ?? ''),
        }))
      })
      .catch((error) => toast.error(errorMessage(error, 'Could not load duration options.')))

    listRoomTypes()
      .then(setRoomTypes)
      .catch(() => {
        /* the room type filter is optional */
      })

    // The rate the server will charge, so the breakdown matches the bill.
    getTaxSettings()
      .then((settings) => setRoomTaxRate(Number(settings.roomTaxRate)))
      .catch(() => setRoomTaxRate(0))
  }, [toast])

  const runSearch = useCallback(
    async (search) => {
      setBusy(true)
      setFieldErrors({})
      try {
        const { rooms, meta } = await searchRooms({
          checkIn: new Date(search.checkIn).toISOString(),
          durationId: search.durationId,
          roomTypeId: search.roomTypeId,
          guests: search.guests,
        })
        setResults(rooms)
        setSearchWindow(meta)
        setSearched(true)
      } catch (error) {
        setFieldErrors(errorDetails(error) ?? {})
        toast.error(errorMessage(error, 'Search failed.'))
      } finally {
        setBusy(false)
      }
    },
    [toast]
  )

  // Arriving from the landing page or /rooms with criteria already chosen: run
  // the search straight away. Once only — afterwards the form is in charge.
  const autoSearched = useRef(false)

  useEffect(() => {
    if (autoSearched.current) return
    if (!handedOver.checkIn || !handedOver.durationId) return

    autoSearched.current = true
    runSearch({
      checkIn: handedOver.checkIn,
      durationId: handedOver.durationId,
      roomTypeId: handedOver.roomTypeId ?? '',
      guests: Number(handedOver.guests) || 1,
    })
  }, [handedOver, runSearch])

  function handleSearch(event) {
    event.preventDefault()
    return runSearch(criteria)
  }

  function selectRoom(room) {
    if (!isAuthenticated) {
      toast.info('Please sign in to complete your booking.')
      navigate('/login', { state: { from: { pathname: '/book' } } })
      return
    }
    setSelectedRoom(room)
    setDetails((current) => ({ ...current, guestName: current.guestName || user?.fullName || '' }))
    setStep('details')
  }

  async function handleCreateBooking() {
    setBusy(true)
    setFieldErrors({})
    try {
      const created = await createBooking({
        room_id: selectedRoom.id,
        duration_id: criteria.durationId,
        check_in: new Date(criteria.checkIn).toISOString(),
        guest_count: criteria.guests,
        guest_name: details.guestName || null,
        id_proof_no: details.idProofNo || null,
        special_requests: details.specialRequests || null,
        coupon_code: details.couponCode || null,
      })
      setBooking(created)
      setStep('payment')
      toast.success('Room held for you. Complete payment to confirm.')
    } catch (error) {
      setFieldErrors(errorDetails(error) ?? {})
      // 409 ROOM_DOUBLE_BOOKED lands here with a clear message.
      toast.error(errorMessage(error, 'Could not create the booking.'))
    } finally {
      setBusy(false)
    }
  }

  async function handlePayAndConfirm() {
    setBusy(true)
    try {
      // A payment that covers the full total confirms the booking inside the
      // same transaction that records it (SRS §4.6), so the response already
      // carries the confirmed booking. Asking for a second confirm would be a
      // Confirmed -> Confirmed move, which the lifecycle guard rejects (409).
      // The fallback still matters: if the room was taken in the meantime the
      // auto-confirm reports rather than throws, and re-confirming surfaces the
      // real reason instead of a success screen for an unconfirmed stay.
      const { autoConfirm } = await addPayment(booking.id, {
        amount: booking.pricing.totalAmount,
        method: paymentMethod,
        payment_type: 'FULL',
      })

      const confirmed = autoConfirm?.confirmed
        ? autoConfirm.booking
        : await confirmBooking(booking.id)

      setBooking(confirmed)
      setStep('done')
      toast.success('Payment recorded and booking confirmed.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not confirm the booking.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageMeta
        title="Book a room"
        description="Check availability and book a room for two hours, a full day, a full night or a day and night."
      />

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-semibold text-neutral-900">Book a room</h1>
          <Stepper steps={STEPS} current={step} className="mt-6" />
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {step === 'search' && (
          <SearchStep
            criteria={criteria}
            setCriteria={setCriteria}
            durations={durations}
            roomTypes={roomTypes}
            fieldErrors={fieldErrors}
            busy={busy}
            searched={searched}
            results={results}
            searchWindow={searchWindow}
            onSubmit={handleSearch}
            onSelect={selectRoom}
          />
        )}

        {step === 'details' && (
          <DetailsStep
            details={details}
            setDetails={setDetails}
            fieldErrors={fieldErrors}
            room={selectedRoom}
            criteria={criteria}
            durations={durations}
            onBack={() => setStep('search')}
            onNext={() => setStep('review')}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            room={selectedRoom}
            criteria={criteria}
            durations={durations}
            details={details}
            setDetails={setDetails}
            couponResult={couponResult}
            setCouponResult={setCouponResult}
            quoted={{
              subtotal: quotedSubtotal,
              discount: quotedDiscount,
              tax: quotedTax,
              total: quotedSubtotal - quotedDiscount + quotedTax,
            }}
            fieldErrors={fieldErrors}
            busy={busy}
            onBack={() => setStep('details')}
            onConfirm={handleCreateBooking}
          />
        )}

        {step === 'payment' && booking && (
          <PaymentStep
            booking={booking}
            method={paymentMethod}
            setMethod={setPaymentMethod}
            busy={busy}
            onPay={handlePayAndConfirm}
          />
        )}

        {step === 'done' && booking && <DoneStep booking={booking} />}
      </div>
    </>
  )
}

/* ── Step 1: search and select ──────────────────────────────────────────── */

function SearchStep({
  criteria,
  setCriteria,
  durations,
  roomTypes,
  fieldErrors,
  busy,
  searched,
  results,
  searchWindow,
  onSubmit,
  onSelect,
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="When would you like to stay?" />
        <CardBody>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <DateTimePicker
              label="Check-in"
              id="checkIn"
              required
              value={criteria.checkIn}
              onChange={(event) =>
                setCriteria((current) => ({ ...current, checkIn: event.target.value }))
              }
              error={fieldErrors.check_in}
            />

            <Select
              label="Duration"
              id="durationId"
              required
              value={criteria.durationId}
              onChange={(event) =>
                setCriteria((current) => ({ ...current, durationId: event.target.value }))
              }
              options={durations.map((duration) => ({
                value: String(duration.id),
                label: `${duration.name} · ${duration.hours} hr`,
              }))}
              error={fieldErrors.duration_id}
            />

            <Select
              label="Room type"
              id="roomTypeId"
              hint="Leave as Any to see every room free in that window."
              value={criteria.roomTypeId}
              onChange={(event) =>
                setCriteria((current) => ({ ...current, roomTypeId: event.target.value }))
              }
              options={[
                { value: '', label: 'Any room type' },
                ...roomTypes.map((roomType) => ({
                  value: String(roomType.id),
                  label: `${roomType.typeName} · sleeps ${roomType.capacity}`,
                })),
              ]}
            />

            <Input
              label="Guests"
              id="guests"
              type="number"
              min={1}
              max={20}
              required
              iconLeft={Users}
              value={criteria.guests}
              onChange={(event) =>
                setCriteria((current) => ({ ...current, guests: event.target.value }))
              }
              error={fieldErrors.guests}
            />

            <div className="sm:col-span-2">
              <Button type="submit" size="lg" loading={busy} iconLeft={Search} fullWidth>
                Search availability
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {busy && (
        <SkeletonGroup label="Searching for rooms" className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </SkeletonGroup>
      )}

      {!busy && searched && (
        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">
              {results.length === 0
                ? 'No rooms available'
                : `${results.length} room${results.length === 1 ? '' : 's'} available`}
            </h2>
            {searchWindow?.checkIn && (
              <p className="text-sm text-neutral-500">
                {dateRange(searchWindow.checkIn, searchWindow.checkOut)}
              </p>
            )}
          </div>

          {results.length === 0 ? (
            <Card>
              <EmptyState
                icon={BedDouble}
                title="Nothing free for that window"
                description="Try a different start time, a shorter duration, or clear the room type filter."
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((room) => (
                <AvailableRoomCard key={room.id} room={room} onSelect={() => onSelect(room)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function AvailableRoomCard({ room, onSelect }) {
  return (
    <Card variant="default" className="flex flex-col overflow-hidden">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-neutral-900">
              Room {room.roomNumber}
            </h3>
            <p className="mt-0.5 text-sm text-neutral-500">
              {room.roomType?.typeName}
              {room.floor ? ` · Floor ${room.floor}` : ''}
            </p>
          </div>
          <Badge tone="neutral" size="sm" icon={Users} dot={false}>
            {room.roomType?.capacity}
          </Badge>
        </div>

        {room.roomType?.amenities && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-neutral-500">
            {room.roomType.amenities}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-xs text-neutral-400">Total for this stay</p>
            <p className="text-xl font-semibold text-neutral-900">
              {money(room.pricing?.totalAmount)}
            </p>
          </div>
          <Button onClick={onSelect} iconRight={ArrowRight}>
            Select
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ── Step 2: guest details ──────────────────────────────────────────────── */

function DetailsStep({ details, setDetails, fieldErrors, room, criteria, durations, onBack, onNext }) {
  const duration = durations.find((entry) => String(entry.id) === String(criteria.durationId))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader
          title="Who is staying?"
          subtitle="We use this at check-in. Only the name is required."
        />
        <CardBody>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onNext()
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Guest name"
                id="guestName"
                required
                autoComplete="name"
                value={details.guestName}
                onChange={(event) =>
                  setDetails((current) => ({ ...current, guestName: event.target.value }))
                }
                error={fieldErrors.guest_name}
              />
              <Input
                label="ID or passport number"
                id="idProofNo"
                hint="Optional — speeds up check-in."
                value={details.idProofNo}
                onChange={(event) =>
                  setDetails((current) => ({ ...current, idProofNo: event.target.value }))
                }
                error={fieldErrors.id_proof_no}
              />
            </div>

            <Textarea
              label="Special requests"
              id="specialRequests"
              rows={3}
              maxLength={500}
              hint="Early check-in, a quiet floor, an extra bed — we'll do what we can."
              value={details.specialRequests}
              onChange={(event) =>
                setDetails((current) => ({ ...current, specialRequests: event.target.value }))
              }
              error={fieldErrors.special_requests}
            />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" type="button" onClick={onBack} iconLeft={ArrowLeft}>
                Back to rooms
              </Button>
              <Button type="submit" size="lg" iconRight={ArrowRight}>
                Continue to review
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <StaySummary room={room} criteria={criteria} duration={duration} />
    </div>
  )
}

/* ── Step 3: review and coupon ──────────────────────────────────────────── */

function ReviewStep({
  room,
  criteria,
  durations,
  details,
  setDetails,
  couponResult,
  setCouponResult,
  quoted,
  fieldErrors,
  busy,
  onBack,
  onConfirm,
}) {
  const duration = durations.find((entry) => String(entry.id) === String(criteria.durationId))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader
          title="Review your booking"
          subtitle="Check the details, add a coupon if you have one, then hold the room."
        />
        <CardBody className="space-y-6">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Room" value={`${room.roomNumber} · ${room.roomType?.typeName}`} />
            <Fact label="Duration" value={duration?.name ?? '—'} />
            <Fact label="Guest" value={details.guestName || '—'} />
            <Fact label="Guests" value={criteria.guests} />
            {details.idProofNo && <Fact label="ID / passport" value={details.idProofNo} />}
            {details.specialRequests && (
              <Fact label="Requests" value={details.specialRequests} className="sm:col-span-2" />
            )}
          </dl>

          <div className="border-t border-neutral-200 pt-5">
            <CouponField
              target="ROOMS"
              subtotal={quoted.subtotal}
              value={details.couponCode}
              onChange={(value) => setDetails((current) => ({ ...current, couponCode: value }))}
              onResult={setCouponResult}
              error={fieldErrors.coupon_code}
            />
          </div>

          <div className="border-t border-neutral-200 pt-5">
            <PriceBreakdown
              subtotal={quoted.subtotal}
              discountAmount={quoted.discount}
              taxAmount={quoted.tax}
              totalAmount={quoted.total}
              note="Estimated until the room is held — the server prices the booking and that figure is what you pay."
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={onBack} iconLeft={ArrowLeft} disabled={busy}>
              Back to details
            </Button>
            <Button size="lg" loading={busy} onClick={onConfirm} iconRight={ArrowRight}>
              Hold this room
            </Button>
          </div>
        </CardBody>
      </Card>

      <StaySummary
        room={room}
        criteria={criteria}
        duration={duration}
        couponApplied={couponResult?.valid}
      />
    </div>
  )
}

/* ── Step 4: payment ────────────────────────────────────────────────────── */

function PaymentStep({ booking, method, setMethod, busy, onPay }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader
          title="Payment"
          subtitle="Your room is held. It is confirmed once a payment is recorded."
        />
        <CardBody className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium text-neutral-800">How will you pay?</legend>
            {PAYMENT_METHODS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-4',
                  'transition-colors duration-hover ease-out',
                  method === option.value
                    ? 'border-primary-800 bg-primary-50/50'
                    : 'border-neutral-200 hover:border-neutral-300'
                )}
              >
                <Radio
                  name="paymentMethod"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                    <option.icon size={16} aria-hidden="true" />
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-neutral-500">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-4">
            <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            <p className="text-sm leading-relaxed text-neutral-600">
              No card details are collected or stored by this system. Payment is taken at the desk
              and recorded against your booking.
            </p>
          </div>

          <Button size="lg" fullWidth loading={busy} onClick={onPay}>
            Pay {money(booking.pricing.totalAmount)} and confirm
          </Button>
        </CardBody>
      </Card>

      <Card variant="elevated" className="h-fit">
        <CardHeader title="Amount due" />
        <CardBody>
          <PriceBreakdown
            subtotal={booking.pricing.subtotal}
            discountAmount={booking.pricing.discountAmount}
            taxAmount={booking.pricing.taxAmount}
            totalAmount={booking.pricing.totalAmount}
            note="These are the figures stored on your booking. Later rate changes will not alter them."
          />
        </CardBody>
      </Card>
    </div>
  )
}

/* ── Step 5: confirmation ───────────────────────────────────────────────── */

function DoneStep({ booking }) {
  const reference = `RRBS-${String(booking.id).padStart(6, '0')}`

  return (
    <div className="mx-auto max-w-2xl">
      <Card variant="elevated" className="overflow-hidden">
        <div className="bg-primary-800 px-6 py-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white">
            <BadgeCheck size={28} aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-semibold text-white">
            Your booking is confirmed
          </h2>
          <p className="mt-1.5 text-sm text-white/70">
            We've held {booking.room?.roomNumber ? `room ${booking.room.roomNumber}` : 'your room'}{' '}
            for you.
          </p>
        </div>

        <CardBody className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-neutral-300 p-5 sm:flex-row">
            {/* Placeholder for the check-in QR code — the desk scans the
                reference until that is issued. */}
            <div
              aria-hidden="true"
              className="grid h-24 w-24 shrink-0 place-items-center rounded bg-neutral-100 text-[10px] font-medium uppercase tracking-wide text-neutral-400"
            >
              QR at check-in
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-xs uppercase tracking-wide text-neutral-400">Booking reference</p>
              <p className="mt-1 font-mono text-lg font-semibold text-neutral-900">{reference}</p>
              <p className="mt-1.5 text-sm text-neutral-500">
                Show this at the front desk when you arrive.
              </p>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact
              label="Stay"
              value={dateRange(booking.checkInDatetime, booking.checkOutDatetime)}
              className="sm:col-span-2"
            />
            <Fact label="Room" value={booking.room?.roomNumber ?? '—'} />
            <Fact label="Guests" value={booking.guestCount} />
          </dl>

          <div className="border-t border-neutral-200 pt-5">
            <PriceBreakdown
              subtotal={booking.pricing.subtotal}
              discountAmount={booking.pricing.discountAmount}
              taxAmount={booking.pricing.taxAmount}
              totalAmount={booking.pricing.totalAmount}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button to="/my-bookings" size="lg" fullWidth>
              View my bookings
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              iconLeft={CalendarPlus}
              href={calendarLink(booking)}
              download={`${reference}.ics`}
            >
              Add to calendar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

/**
 * A downloadable .ics built in the browser.
 *
 * No server round trip and no third-party calendar integration — which keeps
 * this inside the phase's scope while still giving the guest the one thing
 * "add to calendar" needs to do.
 */
function calendarLink(booking) {
  const stamp = (value) => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RRBS//Booking//EN',
    'BEGIN:VEVENT',
    `UID:rrbs-booking-${booking.id}@rrbs.local`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(booking.checkInDatetime)}`,
    `DTEND:${stamp(booking.checkOutDatetime)}`,
    `SUMMARY:Stay at RRBS${booking.room?.roomNumber ? ` — room ${booking.room.roomNumber}` : ''}`,
    `DESCRIPTION:Booking reference RRBS-${String(booking.id).padStart(6, '0')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`
}

/* ── Shared bits ────────────────────────────────────────────────────────── */

function StaySummary({ room, criteria, duration, couponApplied }) {
  if (!room) return null

  return (
    <Card variant="elevated" className="h-fit lg:sticky lg:top-24">
      <CardHeader title="Your stay" />
      <CardBody className="space-y-3">
        <div>
          <p className="font-display text-lg font-semibold text-neutral-900">
            Room {room.roomNumber}
          </p>
          <p className="text-sm text-neutral-500">{room.roomType?.typeName}</p>
        </div>

        <dl className="space-y-2 border-t border-neutral-200 pt-3 text-sm">
          <SummaryRow label="Duration" value={duration?.name ?? '—'} />
          <SummaryRow label="Guests" value={criteria.guests} />
          <SummaryRow label="Room charge" value={money(room.pricing?.subtotal)} />
        </dl>

        {couponApplied && (
          <Badge tone="success" size="sm">
            Coupon applied
          </Badge>
        )}
      </CardBody>
    </Card>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium tabular-nums text-neutral-800">{value}</dd>
    </div>
  )
}

function Fact({ label, value, className }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-800">{value}</dd>
    </div>
  )
}
