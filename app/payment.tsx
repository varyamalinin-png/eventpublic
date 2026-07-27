import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { createLogger } from '../utils/logger';
import { AppIcon } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';

const logger = createLogger('Payment');

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { events, getUserData, sendEventRequest } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  const paymentType = params.type as string | undefined; // 'event_placement' | 'event_participation'
  const eventId = params.eventId as string | undefined;
  const placementPrice = params.placementPrice ? parseFloat(params.placementPrice as string) : 0;
  const targetingPrice = params.targetingPrice ? parseFloat(params.targetingPrice as string) : 0;
  const totalPrice = params.totalPrice ? parseFloat(params.totalPrice as string) : 0;
  const targetingData = params.targeting ? JSON.parse(params.targeting as string) : null;

  const event = eventId && eventId !== 'new' ? events.find(e => e.id === eventId) : null;
  const organizerData = event ? getUserData(event.organizerId) : null;
  const isBusinessAccount = organizerData?.accountType === 'business' || paymentType === 'event_placement';

  // Для оплаты участия проверяем событие
  useEffect(() => {
    if (paymentType === 'event_participation') {
      if (!event) {
        Alert.alert(t.common.error, 'Событие не найдено', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      if (!isBusinessAccount) {
        Alert.alert(t.common.error, t.payment.paymentNotSupported, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
    }
  }, [event, isBusinessAccount, paymentType, router]);

  const handlePayment = async () => {
    if (!cardNumber || !cardExpiry || !cardCVC || !cardholderName) {
      Alert.alert(t.common.error, t.messages.fillAllFields);
      return;
    }

    // Валидация номера карты (упрощенная)
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber.length < 16) {
      Alert.alert(t.common.error, t.payment.invalidCardNumber);
      return;
    }

    setLoading(true);
    try {
      // TODO: Интеграция с платежным шлюзом (эквайринг)
      // Здесь будет вызов API для обработки платежа
      
      // Заглушка: симуляция платежа
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // После успешной оплаты
      if (paymentType === 'event_placement') {
        // Для размещения события возвращаемся на страницу создания с флагом оплаты
        const formDataParam = params.formData as string | undefined;
        Alert.alert(
          t.payment.paymentSuccessful,
          t.payment.placementPaid,
          [
            {
              text: 'OK',
              onPress: () => {
                // Возвращаемся на страницу создания с данными о том, что оплата прошла
                router.push({
                  pathname: '/(tabs)/create',
                  params: {
                    paymentCompleted: 'true',
                    placementPrice: placementPrice.toString(),
                    targetingPrice: targetingPrice.toString(),
                    targeting: params.targeting as string | undefined,
                    formData: formDataParam,
                  }
                });
              },
            },
          ]
        );
      } else if (event && authUser?.id) {
        // Для участия в событии отправляем запрос
        // Для бизнес-аккаунтов запрос автоматически принимается в sendEventRequest
        await sendEventRequest(event.id, authUser.id);
        
        // Даем время на автоматическое принятие запроса
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const organizerData = getUserData(event.organizerId);
        const isBusinessAccount = organizerData?.accountType === 'business';
        
        Alert.alert(
          t.payment.paymentSuccessful,
          isBusinessAccount 
            ? t.payment.paidAndJoined
            : t.payment.paidRequestSent,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      logger.error('Payment error:', error);
      Alert.alert(t.common.error, t.payment.paymentFailed);
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19); // Максимум 16 цифр + 3 пробела
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {paymentType === 'event_placement' ? t.createEvent.eventPlacementPayment : 'Оплата участия'}
        </Text>
      </View>

      {/* Информация о платеже */}
      <View style={styles.eventInfo}>
        {paymentType === 'event_placement' ? (
          <>
            <Text style={styles.eventTitle}>Оплата размещения события</Text>
            <View style={styles.priceBreakdown}>
              <Text style={styles.priceRow}>
                <Text style={styles.priceLabel}>Размещение события:</Text>
                <Text style={styles.priceValue}> {placementPrice} ₽</Text>
              </Text>
              {targetingPrice > 0 && (
                <Text style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Таргетинг:</Text>
                  <Text style={styles.priceValue}> {targetingPrice} ₽</Text>
                  {targetingData && (
                    <Text style={styles.priceSubtext}>
                      {'\n'}  (охват: {targetingData.reach}, отклики: {targetingData.responses})
                    </Text>
                  )}
                </Text>
              )}
              <View style={styles.totalPriceContainer}>
                <Text style={styles.totalPriceLabel}>Итого:</Text>
                <Text style={styles.totalPriceValue}> {totalPrice} ₽</Text>
              </View>
            </View>
          </>
        ) : event ? (
          <>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventPrice}>Цена: {event.price}</Text>
          </>
        ) : null}
      </View>

      {/* Форма оплаты */}
      <View style={styles.paymentForm}>
        <Text style={styles.sectionTitle}>Данные карты</Text>
        
        <Text style={styles.label}>Номер карты</Text>
        <TextInput
          style={styles.input}
          placeholder="1234 5678 9012 3456"
          value={cardNumber}
          onChangeText={(text) => setCardNumber(formatCardNumber(text))}
          keyboardType="numeric"
          maxLength={19}
          placeholderTextColor="#999"
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Срок действия</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/YY"
              value={cardExpiry}
              onChangeText={(text) => setCardExpiry(formatExpiry(text))}
              keyboardType="numeric"
              maxLength={5}
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>CVC</Text>
            <TextInput
              style={styles.input}
              placeholder="123"
              value={cardCVC}
              onChangeText={(text) => setCardCVC(text.replace(/\D/g, '').slice(0, 3))}
              keyboardType="numeric"
              maxLength={3}
              secureTextEntry
              placeholderTextColor="#999"
            />
          </View>
        </View>

        <Text style={styles.label}>Имя держателя карты</Text>
        <TextInput
          style={styles.input}
          placeholder={t.payment.cardHolderExample}
          value={cardholderName}
          onChangeText={setCardholderName}
          autoCapitalize="words"
          placeholderTextColor="#999"
        />
      </View>

      <TouchableOpacity
        style={[styles.payButton, loading && styles.payButtonDisabled]}
        onPress={handlePayment}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#f4f4f5" />
        ) : (
          <Text style={styles.payButtonText}>
            Оплатить {paymentType === 'event_placement' ? `${totalPrice} ₽` : event?.price || '0 ₽'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <AppIcon name="lock" size={14} color={Palette.textFaint} />
        <Text style={[styles.securityNote, { flex: 1 }]}>
          Ваши платежные данные защищены и обрабатываются через безопасный платежный шлюз
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 50,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#FF8D32',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  eventInfo: {
    backgroundColor: '#141417',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 8,
  },
  eventPrice: {
    fontSize: 16,
    color: '#FF8D32',
    fontWeight: '600',
  },
  paymentForm: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#141417',
    color: '#f4f4f5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  payButton: {
    backgroundColor: '#FF8D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '600',
  },
  securityNote: {
    fontSize: 12,
    color: 'rgba(244,244,245,0.35)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  priceBreakdown: {
    marginTop: 8,
  },
  priceRow: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 8,
  },
  priceLabel: {
    color: 'rgba(244,244,245,0.55)',
  },
  priceValue: {
    color: '#FF8D32',
    fontWeight: '600',
  },
  priceSubtext: {
    fontSize: 12,
    color: 'rgba(244,244,245,0.35)',
    fontStyle: 'italic',
  },
  totalPriceContainer: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  totalPriceLabel: {
    fontSize: 18,
    color: '#f4f4f5',
    fontWeight: '600',
  },
  totalPriceValue: {
    fontSize: 18,
    color: '#FF8D32',
    fontWeight: '700',
  },
});

