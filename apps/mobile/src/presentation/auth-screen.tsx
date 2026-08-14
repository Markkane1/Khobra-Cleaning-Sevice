import { type Ref, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { signIn, signUp } from '../application/auth'
import type { Session, SignupInput } from '../domain/auth/types'
import { khobraAuthGateway } from '../infrastructure/http/khobra-gateways'
import { secureSessionStore } from '../infrastructure/storage/secure-session-store'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'

const emptySignup: SignupInput = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  privacyPolicyAccepted: false,
  turnstileToken: '',
}

export function AuthScreen({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const passwordRef = useRef<TextInput>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signup, setSignup] = useState(emptySignup)
  const [submitting, setSubmitting] = useState(false)
  const [captchaVersion, setCaptchaVersion] = useState(0)

  const submit = async () => {
    try {
      setSubmitting(true)
      const session = mode === 'login'
        ? await signIn(khobraAuthGateway, secureSessionStore, email, password, signup.turnstileToken)
        : await signUp(khobraAuthGateway, secureSessionStore, signup)
      onSignedIn(session)
    } catch (error) {
      Alert.alert(mode === 'login' ? 'Sign in failed' : 'Account creation failed', error instanceof Error ? error.message : 'Try again.')
      setSignup(current => ({ ...current, turnstileToken: '' }))
      setCaptchaVersion(version => version + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const updateSignup = (key: keyof SignupInput) => (value: string) => {
    setSignup((current) => ({ ...current, [key]: value }))
  }

  const changeMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode)
    setSignup(current => ({ ...current, turnstileToken: '' }))
    setCaptchaVersion(version => version + 1)
  }

  const openPrivacyPolicy = () => {
    if (!apiBaseUrl) return
    void Linking.openURL(`${apiBaseUrl}/privacy-policy`).catch(() => {
      Alert.alert('Could not open privacy policy', 'Please try again when you are connected to the internet.')
    })
  }

  return <SafeAreaView style={styles.screen}>
    <View style={styles.glowTop} />
    <View style={styles.glowBottom} />
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: mode === 'login' }} disabled={mode === 'login'} onPress={() => changeMode('login')} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed, mode === 'login' && styles.backButtonDisabled]}>
      <Ionicons name="arrow-back" size={22} color="#047857" />
      <Text style={styles.backButtonText}>Back</Text>
    </Pressable>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <View style={styles.logoFrame}>
            <Image source={require('../../assets/logo.png')} resizeMode="contain" style={styles.logo} accessibilityLabel="Khobra Cleaning Services logo" />
          </View>
          <Text style={styles.brandName}>Khobra Cleaning</Text>
          <Text style={styles.tagline}>Professional care, right at your door.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.accent} />
          <View style={styles.tabs}>
            <Tab active={mode === 'login'} label="Sign in" onPress={() => changeMode('login')} />
            <Tab active={mode === 'signup'} label="Create account" onPress={() => changeMode('signup')} />
          </View>

          <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Join Khobra'}</Text>
          <Text style={styles.description}>{mode === 'login' ? 'Sign in to manage your services and operations.' : 'Create your customer account in a few details.'}</Text>
          {!apiBaseUrl ? <View style={styles.notice}><Text style={styles.noticeText}>This app is not connected to the secure production service. Contact support.</Text></View> : null}

          {mode === 'login' ? <View style={styles.form}>
            <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
            <Field inputRef={passwordRef} label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry autoComplete="password" returnKeyType="go" onSubmitEditing={submit} />
          </View> : <View style={styles.form}>
            <Field label="Full name *" value={signup.name} onChangeText={updateSignup('name')} placeholder="Your full name" autoComplete="name" />
            <Field label="Email address *" value={signup.email} onChangeText={updateSignup('email')} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" />
            <Field label="Phone number *" value={signup.phone} onChangeText={updateSignup('phone')} placeholder="+971 50 000 0000" keyboardType="phone-pad" autoComplete="tel" />
            <Field label="Password *" value={signup.password} onChangeText={updateSignup('password')} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" />
            <Field label="Confirm password *" value={signup.confirmPassword} onChangeText={updateSignup('confirmPassword')} placeholder="Enter password again" secureTextEntry autoComplete="new-password" />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: signup.privacyPolicyAccepted }} onPress={() => setSignup(current => ({ ...current, privacyPolicyAccepted: !current.privacyPolicyAccepted }))} style={styles.consent}>
              <Ionicons name={signup.privacyPolicyAccepted ? 'checkbox' : 'square-outline'} size={20} color="#047857" />
              <Text style={styles.consentText}>I accept the Privacy Policy</Text>
            </Pressable>
          </View>}

          {apiBaseUrl ? <View style={styles.captcha}>
            <WebView
              key={`${mode}-${captchaVersion}`}
              source={{ uri: `${apiBaseUrl}/captcha` }}
              onMessage={event => setSignup(current => ({ ...current, turnstileToken: event.nativeEvent.data }))}
              javaScriptEnabled
              scrollEnabled={false}
              style={styles.captchaWebView}
            />
          </View> : null}

          <Pressable accessibilityRole="button" disabled={submitting || !signup.turnstileToken || (mode === 'signup' && !signup.privacyPolicyAccepted)} onPress={submit} style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, (submitting || !signup.turnstileToken || (mode === 'signup' && !signup.privacyPolicyAccepted)) && styles.submitDisabled]}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{mode === 'login' ? 'Sign in to portal' : 'Create customer account'}</Text>}
          </Pressable>

          <Text style={styles.switchText}>{mode === 'login' ? 'New to Khobra?' : 'Already have an account?'}{' '}
            <Text onPress={() => changeMode(mode === 'login' ? 'signup' : 'login')} style={styles.switchLink}>{mode === 'login' ? 'Create an account' : 'Sign in'}</Text>
          </Text>
          {apiBaseUrl ? <Pressable accessibilityRole="link" onPress={openPrivacyPolicy} style={styles.privacyLink} hitSlop={8}>
            <Text style={styles.privacyLinkText}>Privacy Policy</Text>
          </Pressable> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
    <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
  </Pressable>
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string; inputRef?: Ref<TextInput> }

function Field({ label, inputRef, ...props }: FieldProps) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput ref={inputRef} {...props} autoCapitalize={props.keyboardType === 'email-address' ? 'none' : props.autoCapitalize} placeholderTextColor="#8b9b95" selectionColor="#059669" style={styles.input} />
  </View>
}

const headingFont = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' })

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f3faf7' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingVertical: 38 },
  backButton: { zIndex: 2, alignSelf: 'flex-start', minWidth: 88, minHeight: 48, marginLeft: 16, marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: '#cce1d7', backgroundColor: '#ffffffcc', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backButtonPressed: { opacity: 0.75 },
  backButtonDisabled: { opacity: 0.35 },
  backButtonText: { color: '#047857', fontSize: 14, fontWeight: '700' },
  glowTop: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#ccfbf1', top: -100, right: -80, opacity: 0.7 },
  glowBottom: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#d1fae5', bottom: -160, left: -120, opacity: 0.65 },
  brand: { alignItems: 'center', marginBottom: 22 },
  logoFrame: { width: 92, height: 92, borderRadius: 24, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1fae5', shadowColor: '#064e3b', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  logo: { width: '100%', height: '100%' },
  brandName: { marginTop: 13, fontFamily: headingFont, fontSize: 28, fontWeight: '700', color: '#12372a', letterSpacing: -0.5 },
  tagline: { marginTop: 5, color: '#5f746c', fontSize: 14 },
  card: { overflow: 'hidden', backgroundColor: '#ffffffee', borderRadius: 26, borderWidth: 1, borderColor: '#e1eee8', padding: 20, shadowColor: '#064e3b', shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: '#10b981' },
  tabs: { flexDirection: 'row', backgroundColor: '#edf5f1', borderRadius: 13, padding: 4, marginBottom: 22 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', shadowColor: '#064e3b', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  tabText: { color: '#64766f', fontWeight: '600', fontSize: 14 },
  activeTabText: { color: '#047857' },
  title: { fontFamily: headingFont, color: '#15251d', fontSize: 24, fontWeight: '700' },
  description: { color: '#64766f', fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20 },
  form: { gap: 14 },
  field: { gap: 7 },
  label: { color: '#344b42', fontSize: 14, fontWeight: '700' },
  input: { height: 50, borderRadius: 13, borderWidth: 1, borderColor: '#ccdad4', backgroundColor: '#fbfdfc', color: '#15251d', paddingHorizontal: 15, fontSize: 14 },
  notice: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#d1fae5', paddingHorizontal: 11, paddingVertical: 6 },
  noticeText: { color: '#047857', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { gap: 12 },
  half: { flex: 1 },
  submit: { minHeight: 52, marginTop: 20, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', shadowColor: '#047857', shadowOpacity: 0.22, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  submitPressed: { backgroundColor: '#047857', transform: [{ scale: 0.99 }] },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  switchText: { color: '#64766f', textAlign: 'center', fontSize: 14, marginTop: 18 },
  switchLink: { color: '#047857', fontWeight: '700' },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  consentText: { color: '#355248', fontSize: 13, flexShrink: 1 },
  privacyLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  privacyLinkText: { color: '#047857', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  captcha: { height: 72, marginTop: 16, overflow: 'hidden', borderRadius: 12 },
  captchaWebView: { flex: 1, backgroundColor: 'transparent' },
})
