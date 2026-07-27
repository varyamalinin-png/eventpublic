import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../../components/TopBar';
import EventCard from '../../components/EventCard';
import { useEvents, Event } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AppIcon } from '../../components/ui/AppIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SavedScreen() {
  const router = useRouter();
  const { getSavedEvents, getSavedMemoryPosts, getUserData, eventProfiles } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'memories'>('events');

  const handleSavedSearch = (query: string) => setSearchQuery(query);

  const savedEvents = useMemo(() => getSavedEvents(), [getSavedEvents]);

  const savedMemoryPosts = useMemo(
    () => getSavedMemoryPosts(eventProfiles),
    [getSavedMemoryPosts, eventProfiles],
  );

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return savedEvents;
    const q = searchQuery.toLowerCase();
    return savedEvents.filter(event => {
      if (event.title.toLowerCase().includes(q)) return true;
      if (event.description?.toLowerCase().includes(q)) return true;
      if (event.location?.toLowerCase().includes(q)) return true;
      if (event.displayDate?.toLowerCase().includes(q)) return true;
      if (event.time?.toLowerCase().includes(q)) return true;
      const org = getUserData(event.organizerId);
      return org.name.toLowerCase().includes(q) || org.username.toLowerCase().includes(q);
    });
  }, [savedEvents, searchQuery, getUserData]);

  // ⚠️  ВАЖНО: этот useMemo должен быть ДО любых conditional return!
  const filteredMemoryPosts = useMemo(() => {
    if (!searchQuery.trim()) return savedMemoryPosts;
    const q = searchQuery.toLowerCase();
    return savedMemoryPosts.filter(({ post }) => {
      if (post.caption?.toLowerCase().includes(q)) return true;
      const author = getUserData(post.authorId);
      return (
        author.name.toLowerCase().includes(q) ||
        author.username.toLowerCase().includes(q)
      );
    });
  }, [savedMemoryPosts, searchQuery, getUserData]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (!authUser) {
    return (
      <View style={styles.container}>
        <TopBar
          searchPlaceholder={t.empty.searchSaved}
          onSearchChange={handleSavedSearch}
          searchQuery={searchQuery}
        />
        <View style={styles.emptyContainer}>
          <AppIcon name="lock" size={60} color="rgba(244,244,245,0.25)" />
          <Text style={styles.emptyTitle}>Войдите в аккаунт</Text>
          <Text style={styles.emptyText}>
            Авторизуйтесь, чтобы просматривать сохранённые события
          </Text>
        </View>
      </View>
    );
  }

  // Grid column math
  const GRID_H_PAD = 16;
  const GRID_GAP = 2;
  const gridAvailable = SCREEN_WIDTH - GRID_H_PAD * 2;
  const cellSize = (gridAvailable - GRID_GAP * 2) / 3;

  return (
    <View style={styles.container}>
      <TopBar
        searchPlaceholder={t.empty.searchSaved}
        onSearchChange={handleSavedSearch}
        searchQuery={searchQuery}
      />

      {/* Таб-переключатель */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            {t.settings?.saved?.savedEvents || t.tabs.explore}
          </Text>
          {filteredEvents.length > 0 && (
            <View style={[styles.badge, activeTab === 'events' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'events' && styles.badgeTextActive]}>
                {filteredEvents.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'memories' && styles.tabActive]}
          onPress={() => setActiveTab('memories')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'memories' && styles.tabTextActive]}>
            {t.settings?.saved?.savedMemories || t.tabs.memories}
          </Text>
          {filteredMemoryPosts.length > 0 && (
            <View style={[styles.badge, activeTab === 'memories' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'memories' && styles.badgeTextActive]}>
                {filteredMemoryPosts.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF8D32"
            colors={['#FF8D32']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'events' ? (
          filteredEvents.length === 0 ? (
            <EmptyState
              iconName="bookmark"
              title={searchQuery ? t.empty.nothingFound : 'Нет сохранённых событий'}
              subtitle={searchQuery ? t.empty.tryAnotherQuery : 'Нажмите ♡ на событии чтобы сохранить'}
            />
          ) : (
            <View style={styles.eventsList}>
              {filteredEvents.map(event => (
                <View key={event.id} style={styles.eventCardWrapper}>
                  <EventCard
                    id={event.id}
                    title={event.title}
                    description={event.description || ''}
                    date={event.date}
                    time={event.time}
                    displayDate={event.displayDate}
                    location={event.location || ''}
                    price={event.price || t.createEvent.free}
                    participants={event.participants || 0}
                    maxParticipants={event.maxParticipants || 10}
                    organizerAvatar={getUserData(event.organizerId)?.avatar || ''}
                    organizerId={event.organizerId}
                    variant="default"
                    showSwipeAction={false}
                    mediaUrl={event.mediaUrl}
                    mediaType={event.mediaType}
                    mediaAspectRatio={event.mediaAspectRatio}
                    participantsList={event.participantsList}
                    participantsData={event.participantsData}
                    context="other_profile"
                  />
                </View>
              ))}
            </View>
          )
        ) : (
          filteredMemoryPosts.length === 0 ? (
            <EmptyState
              iconName="image"
              title={searchQuery ? t.empty.nothingFound : t.empty.noSavedMemories}
              subtitle={searchQuery ? t.empty.tryAnotherQuery : t.empty.saveFromMemories}
            />
          ) : (
            <View style={styles.memoryGrid}>
              {filteredMemoryPosts.map(({ post, eventId }, index) => {
                const isLastInRow = (index + 1) % 3 === 0;
                const effectiveType: 'photo' | 'video' | 'music' | 'text' = (() => {
                  if (post.photoUrl) return 'photo';
                  if (typeof post.content === 'string' && /\.(mp4|mov|m4v)$/i.test(post.content)) return 'video';
                  return (post as any).type ?? 'text';
                })();

                return (
                  <TouchableOpacity
                    key={`${eventId}-${post.id}`}
                    style={[
                      styles.memoryCell,
                      {
                        width: cellSize,
                        height: cellSize,
                        marginRight: isLastInRow ? 0 : GRID_GAP,
                        marginBottom: GRID_GAP,
                      },
                    ]}
                    onPress={() => router.push(`/event-profile/${eventId}`)}
                    activeOpacity={0.85}
                  >
                    {(effectiveType === 'photo' || effectiveType === 'video' || effectiveType === 'music') ? (
                      <>
                        <Image
                          source={{
                            uri:
                              effectiveType === 'music'
                                ? (post as any).artwork_url || post.photoUrl || post.content
                                : post.photoUrl || post.content,
                          }}
                          style={styles.memoryCellImage}
                          resizeMode="cover"
                        />
                        {effectiveType === 'video' && (
                          <View style={styles.playBadge}>
                            <Text style={styles.playBadgeIcon}>▶</Text>
                          </View>
                        )}
                        {effectiveType === 'music' && (
                          <View style={styles.playBadge}>
                            <Text style={styles.playBadgeIcon}>♪</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.memoryCellText}>
                        <Text style={styles.memoryCellTextContent} numberOfLines={4}>
                          {post.content}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function EmptyState({
  iconName,
  title,
  subtitle,
}: {
  iconName: 'bookmark' | 'image' | 'heart' | 'camera' | 'search';
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.emptyContainer}>
      <AppIcon name={iconName} size={60} color="rgba(244,244,245,0.25)" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptyText}>{subtitle}</Text> : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 0,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  tabActive: {
    backgroundColor: 'rgba(255,141,50,0.12)',
    borderColor: '#FF8D32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(244,244,245,0.5)',
  },
  tabTextActive: {
    color: '#FF8D32',
    fontWeight: '600',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,141,50,0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(244,244,245,0.5)',
  },
  badgeTextActive: {
    color: '#FF8D32',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },

  // ── Events list ───────────────────────────────────────────────────────────
  eventsList: {
    paddingHorizontal: 0,
  },
  eventCardWrapper: {
    marginBottom: 0,
  },

  // ── Memories grid ─────────────────────────────────────────────────────────
  memoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  memoryCell: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  memoryCellImage: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadgeIcon: {
    color: '#f4f4f5',
    fontSize: 10,
    fontWeight: 'bold',
  },
  memoryCellText: {
    flex: 1,
    padding: 8,
    backgroundColor: '#1c1c20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryCellTextContent: {
    fontSize: 11,
    color: 'rgba(244,244,245,0.7)',
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Empty ─────────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.45)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
