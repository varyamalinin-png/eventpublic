import { StyleSheet, Platform } from 'react-native';

export const settingsStyles = StyleSheet.create(
{
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginPromptTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 12,
  },
  loginPromptText: {
    fontSize: 16,
    color: '#BBBBCC',
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#FF8D32',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f4f4f5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(244,244,245,0.55)',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 30,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  settingLabel: {
    fontSize: 16,
    color: '#f4f4f5',
    flex: 1,
  },
  settingValue: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
    marginRight: 10,
  },
  settingAvatarPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2E2E2E',
    marginRight: 8,
  },
  accountsCard: {
    backgroundColor: '#1B1B1B',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
  },
  accountRowActive: {
    borderBottomColor: '#2F2F2F',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#2E2E2E',
  },
  accountAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextColumn: {
    flex: 1,
  },
  accountName: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
  accountMeta: {
    color: '#9A9A9A',
    fontSize: 13,
    marginTop: 2,
  },
  accountBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#2E2E3F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  accountBadgeText: {
    color: '#B9B9FF',
    fontSize: 11,
    fontWeight: '600',
  },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  accountActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  accountActionPrimary: {
    backgroundColor: '#FF8D32',
  },
  accountActionSecondary: {
    backgroundColor: '#2E2E2E',
  },
  accountActionPrimaryText: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: '600',
  },
  accountActionSecondaryText: {
    color: '#BBB',
    fontSize: 13,
    fontWeight: '500',
  },
  accountAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  accountAddButtonText: {
    color: '#FF8D32',
    fontSize: 15,
    fontWeight: '600',
  },
  accountHint: {
    marginTop: 6,
    color: '#777',
    fontSize: 12,
    lineHeight: 16,
  },
  dangerItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  dangerText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#141417',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 15,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#f4f4f5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  modalButtonsColumn: {
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonFull: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#FF8D32',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalButtonConfirm: {
    backgroundColor: '#FF8D32',
  },
  modalButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
  accountModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  accountModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  accountModeButtonActive: {
    backgroundColor: '#FF8D32',
  },
  accountModeButtonText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    fontWeight: '600',
  },
  accountModeButtonTextActive: {
    color: '#f4f4f5',
  },
  accountErrorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginBottom: 10,
  },
  accountStatusText: {
    color: '#FF8D32',
    fontSize: 13,
    marginBottom: 10,
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarPreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarUploadSpinner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -12,
    marginTop: -12,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  datePickerButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
  },
  genderOption: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  genderOptionSelected: {
    backgroundColor: '#FF8D32',
  },
  genderOptionText: {
    color: '#f4f4f5',
    fontSize: 16,
  },
  genderOptionTextSelected: {
    color: '#f4f4f5',
    fontWeight: 'bold',
  },
});


