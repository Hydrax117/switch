import 'server-only'
import { db } from '@/lib/db'

// ─── Overview stats ───────────────────────────────────────────────────────────

export async function getAdminOverviewStats() {
  const [
    pendingKyc,
    pendingPayouts,
    openRefunds,
    totalUsers,
    totalOrganizers,
    totalEvents,
    totalTickets,
    recentPayments,
  ] = await Promise.all([
    db.organizerApplication.count({ where: { kycStatus: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    db.payoutRequest.count({ where: { status: 'PENDING' } }),
    db.refundRequest.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    db.user.count(),
    db.organizer.count({ where: { status: 'ACTIVE' } }),
    db.event.count({ where: { status: 'PUBLISHED' } }),
    db.ticket.count(),
    db.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true, platformFeeAmount: true },
    }),
  ])

  return {
    pendingKyc,
    pendingPayouts,
    openRefunds,
    totalUsers,
    totalOrganizers,
    totalEvents,
    totalTickets,
    totalRevenue: recentPayments._sum.amount ?? 0,
    totalFees: recentPayments._sum.platformFeeAmount ?? 0,
  }
}

// ─── KYC applications ─────────────────────────────────────────────────────────

export async function getKycApplications(status?: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ALL') {
  const where =
    !status || status === 'ALL'
      ? {}
      : { kycStatus: status as 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' }

  return db.organizerApplication.findMany({
    where,
    select: {
      id: true,
      organizerName: true,
      bio: true,
      idType: true,
      idDocUrl: true,
      instagramUrl: true,
      twitterUrl: true,
      facebookUrl: true,
      websiteUrl: true,
      kycStatus: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, image: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export type KycApplication = Awaited<ReturnType<typeof getKycApplications>>[number]

// ─── Payout requests ──────────────────────────────────────────────────────────

export async function getAdminPayoutRequests(status?: string) {
  const where = !status || status === 'ALL' ? {} : { status: status as 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' }

  return db.payoutRequest.findMany({
    where,
    select: {
      id: true,
      grossAmount: true,
      totalFees: true,
      netAmount: true,
      currency: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      paystackTransferCode: true,
      createdAt: true,
      organizer: {
        select: {
          id: true,
          name: true,
          slug: true,
          bankCode: true,
          bankAccountNumber: true,
          bankAccountName: true,
          user: { select: { email: true } },
        },
      },
      event: { select: { id: true, title: true, slug: true, startsAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export type AdminPayoutRequest = Awaited<ReturnType<typeof getAdminPayoutRequests>>[number]

// ─── Refund requests ──────────────────────────────────────────────────────────

export async function getAdminRefundRequests(status?: string) {
  const where = !status || status === 'ALL' ? {} : { status: status as 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' }

  return db.refundRequest.findMany({
    where,
    select: {
      id: true,
      reason: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      paystackRefundId: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
      event: { select: { id: true, title: true, slug: true } },
      payment: {
        select: {
          id: true,
          amount: true,
          currency: true,
          paystackReference: true,
          paystackTransactionId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export type AdminRefundRequest = Awaited<ReturnType<typeof getAdminRefundRequests>>[number]
