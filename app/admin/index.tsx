import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppIcon, AppIconName } from '../../components/ui/AppIcon';
import { Palette, Radius } from '../../constants/DesignSystem';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminDashboard');

interface OverviewStats {
  users: {
    total: number;
    active: number;
    blocked: number;
    recent: number;
  };
  events: {
    total: number;
    upcoming: number;
    past: number;
    recent: number;
  };
  complaints: {
    total: number;
    pending: number;
    resolved: number;
  };
  messages: {
    total: number;
  };
  onlineUsers: number;
}

/* ─── Пульсирующая зелёная точка (онлайн-индикатор) ─── */
function PulsingDot() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[styles.pulsingDot, { opacity: pulseAnim }]}
    />
  );
}

/* ─── Большая метрика-карточка ─── */
function MetricCard({
  icon,
  iconColor,
  value,
  label,
  badge,
  badgeColor,
  extra,
}: {
  icon: AppIconName;
  iconColor: string;
  value: number | string;
  label: string;
  badge?: React.ReactNode;
  badgeColor?: string;
  extra?: React.ReactNode;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricCardHeader}>
        <View style={[styles.metricIconWrap, { backgroundColor: iconColor + '18' }]}>
          <AppIcon name={icon} size={20} color={iconColor} />
        </View>
        {badge}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {extra}
    </View>
  );
}

/* ─── Мини-метрика в строке ─── */
function QuickStat({
  icon,
  value,
  label,
}: {
  icon: AppIconName;
  value: number | string;
  label: string;
}) {
  return (
    <View style={styles.quickStat}>
      <View style={styles.quickStatIcon}>
        <AppIcon name={icon} size={14} color={Palette.textDim} />
      </View>
      <Text style={styles.quickStatValue}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
}

/* ─── Навигационная карточка ─── */
function NavCard({
  icon,
  iconColor,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: AppIconName;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.navCard}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.navCardLeft}>
        <View style={[styles.navIconWrap, { backgroundColor: iconColor + '18' }]}>
          <AppIcon name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.navCardText}>
          <View style={styles.navTitleRow}>
            <Text style={styles.navTitle}>{title}</Text>
            {badge !== undefined && badge > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.navSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <AppIcon name="chevronRight" size={18} color={Palette.textFaint} />
    </TouchableOpacity>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Главный экран — AdminDashboardScreen
   ═══════════════════════════════════════════════════════════════ */
export default function AdminDashboardScreen() {
  const router = useRouter();
  const { accessToken: authToken } = useAuth();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth.accessToken') : null);

  const fetchStats = useCallback(async () => {
    if (!accessToken) {
      setError('Необходима авторизация');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await apiRequest('/admin/statistics/overview', {}, accessToken);
      setStats(data);
    } catch (err: any) {
      logger.error('Failed to fetch stats:', err);
      if (err.status === 403) {
        setError('Нет прав администратора');
      } else {
        setError('Не удалось загрузить статистику');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  /* ─── Загрузка ─── */
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Palette.accent} />
        <Text style={styles.loadingText}>Загрузка панели...</Text>
      </View>
    );
  }

  /* ─── Ошибка ─── */
  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <AppIcon name="alertTriangle" size={40} color={Palette.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = stats!;

  return (
    <View style={styles.container}>
      {/* ─── Шапка ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <AppIcon name="chevronLeft" size={22} color={Palette.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Панель управления</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onRefresh} hitSlop={12}>
            <AppIcon name="activity" size={20} color={Palette.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.accent}
          />
        }
      >
        {/* ─── Приветствие ─── */}
        <Text style={styles.sectionGreeting}>Обзор</Text>

        {/* ═══ ВЕРХНИЙ БЛОК: 4 основные метрики (2x2) ═══ */}
        <View style={styles.metricsGrid}>
          {/* Пользователи */}
          <MetricCard
            icon="users"
            iconColor="#5B8DEF"
            value={s.users.total}
            label="Пользователи"
          />
          {/* События */}
          <MetricCard
            icon="calendar"
            iconColor={Palette.accent}
            value={s.events.total}
            label="События"
          />
          {/* Онлайн */}
          <MetricCard
            icon="wifi"
            iconColor={Palette.success}
            value={s.onlineUsers}
            label="Онлайн сейчас"
            badge={<PulsingDot />}
          />
          {/* Жалобы */}
          <MetricCard
            icon="alertTriangle"
            iconColor={s.complaints.pending > 0 ? Palette.warning : Palette.textDim}
            value={s.complaints.pending}
            label="Ожидают решения"
            badge={
              s.complaints.pending > 0 ? (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningBadgeText}>{s.complaints.pending}</Text>
                </View>
              ) : undefined
            }
          />
        </View>

        {/* ═══ СРЕДНИЙ БЛОК: Быстрая статистика ═══ */}
        <Text style={styles.sectionLabel}>ПОДРОБНОСТИ</Text>
        <View style={styles.quickStatsCard}>
          <View style={styles.quickStatsRow}>
            <QuickStat
              icon="calendar"
              value={s.events.upcoming}
              label="Предстоящих"
            />
            <View style={styles.quickStatsDivider} />
            <QuickStat
              icon="clock"
              value={s.events.past}
              label="Прошедших"
            />
            <View style={styles.quickStatsDivider} />
            <QuickStat
              icon="trendingUp"
              value={s.events.recent}
              label="Новых (30д)"
            />
          </View>

          <View style={styles.quickStatsRowDivider} />

          <View style={styles.quickStatsRow}>
            <QuickStat
              icon="userPlus"
              value={s.users.recent}
              label="Новые (30д)"
            />
            <View style={styles.quickStatsDivider} />
            <QuickStat
              icon="message"
              value={formatNumber(s.messages.total)}
              label="Сообщений"
            />
            <View style={styles.quickStatsDivider} />
            <QuickStat
              icon="userX"
              value={s.users.blocked}
              label="Заблок."
            />
          </View>
        </View>

        {/* ═══ ДОПОЛНИТЕЛЬНАЯ СТРОКА: Жалобы всего ═══ */}
        <View style={styles.complaintsRow}>
          <View style={styles.complaintsMini}>
            <View style={[styles.complaintsDot, { backgroundColor: Palette.success }]} />
            <Text style={styles.complaintsLabel}>Решено</Text>
            <Text style={styles.complaintsValue}>{s.complaints.resolved}</Text>
          </View>
          <View style={styles.complaintsMini}>
            <View style={[styles.complaintsDot, { backgroundColor: Palette.warning }]} />
            <Text style={styles.complaintsLabel}>Ожидают</Text>
            <Text style={styles.complaintsValue}>{s.complaints.pending}</Text>
          </View>
          <View style={styles.complaintsMini}>
            <View style={[styles.complaintsDot, { backgroundColor: Palette.textDim }]} />
            <Text style={styles.complaintsLabel}>Всего</Text>
            <Text style={styles.complaintsValue}>{s.complaints.total}</Text>
          </View>
        </View>

        {/* ═══ НИЖНИЙ БЛОК: Навигация ═══ */}
        <Text style={styles.sectionLabel}>УПРАВЛЕНИЕ</Text>

        <NavCard
          icon="flag"
          iconColor={Palette.warning}
          title="Жалобы"
          subtitle="Модерация и обработка обращений"
          badge={s.complaints.pending}
          onPress={() => router.push('/admin/complaints')}
        />

        <NavCard
          icon="users"
          iconColor="#5B8DEF"
          title="Пользователи"
          subtitle={`${s.users.total} зарегистрировано, ${s.users.active} активных`}
          onPress={() => {
            // Пока навигация к списку пользователей
            router.push('/admin/complaints');
          }}
        />

        <NavCard
          icon="calendar"
          iconColor={Palette.accent}
          title="События"
          subtitle={`${s.events.upcoming} предстоящих, ${s.events.past} прошедших`}
          onPress={() => {
            // Пока навигация к модерации событий
            router.push('/admin/complaints');
          }}
        />

        <NavCard
          icon="mail"
          iconColor="#A78BFA"
          title="Обращения"
          subtitle="info@, privacy@, support@iwent.ru"
          onPress={() => router.push('/admin/mail' as any)}
        />

        {/* Нижний отступ */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ─── Утилита: сокращение больших чисел ─── */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

/* ═══════════════════════════════════════════════════════════════
   Стили
   ═══════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  /* layout */
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
  },
  headerTitle: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 32,
    alignItems: 'flex-end',
  },

  /* loading / error */
  loadingText: {
    color: Palette.textDim,
    fontSize: 14,
    marginTop: 14,
  },
  errorText: {
    color: Palette.text,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Palette.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  retryButtonText: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },

  /* sections */
  sectionGreeting: {
    color: Palette.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    color: Palette.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 12,
    marginLeft: 4,
  },

  /* ═══ Metric cards (2x2) ═══ */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.line,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    color: Palette.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  metricLabel: {
    color: Palette.textDim,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },

  /* pulsing dot */
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },

  /* warning badge */
  warningBadge: {
    backgroundColor: Palette.warning,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  warningBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ═══ Quick stats ═══ */
  quickStatsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.line,
  },
  quickStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickStatsRowDivider: {
    height: 1,
    backgroundColor: Palette.line,
    marginVertical: 14,
  },
  quickStatsDivider: {
    width: 1,
    height: 36,
    backgroundColor: Palette.line,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatIcon: {
    marginBottom: 6,
  },
  quickStatValue: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  quickStatLabel: {
    color: Palette.textFaint,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },

  /* ═══ Complaints summary row ═══ */
  complaintsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Palette.line,
  },
  complaintsMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  complaintsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  complaintsLabel: {
    color: Palette.textDim,
    fontSize: 13,
    fontWeight: '500',
  },
  complaintsValue: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
  },

  /* ═══ Nav cards ═══ */
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Palette.line,
  },
  navCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  navCardText: {
    flex: 1,
  },
  navTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navTitle: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  navBadge: {
    backgroundColor: Palette.warning,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  navBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  navSubtitle: {
    color: Palette.textDim,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
});
