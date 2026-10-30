import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Image, Platform, KeyboardAvoidingView
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { auth, db, storage, firebaseReady } from "./firebase";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile
} from "firebase/auth";
import {
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp,
  doc, setDoc, getDoc, updateDoc, arrayUnion
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const CREATOR_EMAIL = "isaacbabysonguy@gmail.com";
const CREATOR_PHONE = "0840981930"; // Pour affichage uniquement; ne sert PAS de preuve d'identité.
const colors = { bg:"#0b141a", panel:"#202c33", gold:"#ffcc00", green:"#25d366", text:"#e9edef", muted:"#aebac1", blue:"#2196f3" };

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [screen, setScreen] = useState("auth");
  const [authMode, setAuthMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [message, setMessage] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [basicMode, setBasicMode] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingNow, setRecordingNow] = useState(false);
  const [audioSound, setAudioSound] = useState(null);
  const [busy, setBusy] = useState(false);
  const stopSub = useRef(null);

  useEffect(() => {
    if (!firebaseReady) { setScreen("setup"); return; }
    return onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        const p = snap.exists() ? snap.data() : { displayName: u.displayName || "", bio: "" };
        setProfile(p); setName(p.displayName || u.displayName || ""); setBio(p.bio || "");
        setScreen("chats");
      } else { setScreen("auth"); setActiveChat(null); }
    });
  }, []);

  useEffect(() => {
    if (!user || !firebaseReady) return;
    const q = query(collection(db, "users"), orderBy("displayName"));
    return onSnapshot(q, snap => setContacts(snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(p => p.id !== user.uid)));
  }, [user]);

  useEffect(() => {
    if (stopSub.current) { stopSub.current(); stopSub.current = null; }
    if (!user || !activeChat) { setMessages([]); return; }
    const q = query(collection(db, "messages"), where("chatId", "==", chatKey(user.uid, activeChat.id)), orderBy("createdAt", "asc"));
    stopSub.current = onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id:d.id, ...d.data() }))), err => Alert.alert("Messages", err.message));
    return () => stopSub.current && stopSub.current();
  }, [user, activeChat]);

  function chatKey(a,b) { return [a,b].sort().join("__"); }
  function isCreator() { return !!user && user.email?.toLowerCase() === CREATOR_EMAIL.toLowerCase(); }
  function alertError(e) { Alert.alert("IBS-CHAT SOCIAL", e?.message || "Une erreur est survenue."); }

  async function doAuth() {
    if (!email.trim() || password.length < 6) return Alert.alert("Compte", "Saisissez un e-mail et un mot de passe d'au moins 6 caractères.");
    setBusy(true);
    try {
      let result;
      if (authMode === "register") result = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      else result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      if (authMode === "register") {
        await updateProfile(result.user, { displayName: name.trim() || email.split("@")[0] });
        await setDoc(doc(db, "users", result.user.uid), {
          email: result.user.email, displayName: name.trim() || email.split("@")[0],
          bio: "", photoURL: "", createdAt: serverTimestamp()
        });
      }
    } catch(e) { alertError(e); } finally { setBusy(false); }
  }

  async function saveProfile() {
    if (!user) return;
    const p = { ...profile, displayName: name.trim(), bio: bio.trim(), email: user.email };
    try {
      await updateProfile(user, { displayName: name.trim() });
      await setDoc(doc(db, "users", user.uid), p, { merge:true });
      setProfile(p); Alert.alert("Profil", "Profil enregistré.");
    } catch(e) { alertError(e); }
  }

  async function choosePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Photos", "Autorisez l'accès aux photos dans les paramètres du téléphone.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:["images"], quality: basicMode ? 0.35 : 0.8 });
    if (result.canceled) return;
    try {
      setBusy(true);
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `profilePhotos/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob, { contentType:"image/jpeg" });
      const photoURL = await getDownloadURL(fileRef);
      await setDoc(doc(db, "users", user.uid), { photoURL }, { merge:true });
      setProfile(p => ({ ...p, photoURL }));
    } catch(e) { alertError(e); } finally { setBusy(false); }
  }

  async function startChat() {
    const found = contacts.find(c => c.email?.toLowerCase() === targetEmail.trim().toLowerCase());
    if (!found) return Alert.alert("Nouveau chat", "Aucun compte trouvé avec cet e-mail. La personne doit d'abord s'inscrire.");
    setActiveChat(found); setTargetEmail(""); setScreen("chat");
  }

  async function sendText() {
    if (!message.trim() || !activeChat) return;
    const text = message.trim(); setMessage("");
    try {
      await addDoc(collection(db, "messages"), {
        chatId:chatKey(user.uid, activeChat.id), senderId:user.uid, recipientId:activeChat.id,
        type:"text", text, createdAt:serverTimestamp()
      });
    } catch(e) { setMessage(text); alertError(e); }
  }

  async function startVoice() {
    if (!activeChat) return Alert.alert("Vocal", "Ouvrez d'abord une conversation.");
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert("Microphone", "Autorisez le microphone dans les paramètres.");
      await Audio.setAudioModeAsync({ allowsRecordingIOS:true, playsInSilentModeIOS:true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync(); setRecording(rec); setRecordingNow(true);
    } catch(e) { alertError(e); }
  }

  async function stopVoiceAndSend() {
    if (!recording || !activeChat) return;
    setRecordingNow(false); setBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error("L'enregistrement audio est vide.");
      const response = await fetch(uri); const blob = await response.blob();
      const audioRef = ref(storage, `voiceMessages/${chatKey(user.uid, activeChat.id)}/${Date.now()}.m4a`);
      await uploadBytes(audioRef, blob, { contentType: blob.type || "audio/m4a" });
      const audioURL = await getDownloadURL(audioRef);
      await addDoc(collection(db, "messages"), {
        chatId:chatKey(user.uid, activeChat.id), senderId:user.uid, recipientId:activeChat.id,
        type:"audio", audioURL, createdAt:serverTimestamp()
      });
    } catch(e) { alertError(e); } finally { setBusy(false); }
  }

  async function playAudio(url) {
    try {
      if (audioSound) { await audioSound.unloadAsync(); setAudioSound(null); }
      const { sound } = await Audio.Sound.createAsync({ uri:url }, { shouldPlay:true });
      setAudioSound(sound);
    } catch(e) { alertError(e); }
  }

  async function logout() { if (audioSound) await audioSound.unloadAsync(); await signOut(auth); }

  const Btn = ({ title, onPress, style }) => <TouchableOpacity onPress={onPress} style={[styles.button, style]}><Text style={styles.buttonText}>{title}</Text></TouchableOpacity>;
  const Field = props => <TextInput placeholderTextColor="#aebac1" style={styles.input} {...props} />;

  if (screen === "setup") return <View style={styles.center}><Text style={styles.title}>IBS-CHAT SOCIAL</Text><Text style={styles.body}>Avant utilisation, configurez Firebase dans firebase.js. Cette étape est nécessaire pour créer de vrais comptes et synchroniser les messages entre appareils.</Text><Text style={styles.body}>Ouvrez README-FR.md pour les étapes.</Text></View>;

  if (!user) return <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <StatusBar style="light" /><Text style={styles.title}>IBS-CHAT SOCIAL</Text>
    <Text style={styles.subtitle}>{authMode === "register" ? "Créer mon compte" : "Se connecter"}</Text>
    {authMode === "register" && <Field placeholder="Votre nom" value={name} onChangeText={setName} />}
    <Field placeholder="Adresse e-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    <Field placeholder="Mot de passe (6 caractères minimum)" secureTextEntry value={password} onChangeText={setPassword} />
    <Btn title={busy ? "Patientez..." : (authMode === "register" ? "Créer mon compte" : "Connexion")} onPress={doAuth} />
    <Btn title={authMode === "register" ? "J'ai déjà un compte" : "Créer un nouveau compte"} onPress={() => setAuthMode(authMode === "register" ? "login" : "register")} style={styles.secondary} />
    <Text style={styles.note}>Les comptes e-mail fonctionnent après activation de Firebase Authentication. L'inscription par SMS/OTP nécessite une configuration supplémentaire.</Text>
  </KeyboardAvoidingView>;

  const title = screen === "profile" ? "Mon profil" : screen === "settings" ? "Paramètres" : screen === "about" ? "Mon histoire" : screen === "chat" ? (activeChat?.displayName || activeChat?.email || "Conversation") : "Discussions";

  return <View style={styles.app}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <Text style={styles.brand}>IBS-CHAT SOCIAL</Text>
      <TouchableOpacity onPress={() => setBasicMode(v => !v)}><Text style={styles.mode}>{basicMode ? "MODE BASIQUE : ON" : "MODE BASIQUE : OFF"}</Text></TouchableOpacity>
    </View>
    <View style={styles.subheader}><Text style={styles.subtitle}>{title}</Text>{isCreator() && <Text style={styles.verified}>✓ FONDATEUR VÉRIFIÉ</Text>}</View>

    {screen === "chats" && <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.body}>Connecté en tant que {user.email}</Text>
      <Field placeholder="E-mail du contact pour démarrer un chat" value={targetEmail} onChangeText={setTargetEmail} autoCapitalize="none" keyboardType="email-address" />
      <Btn title="Nouveau chat" onPress={startChat} />
      <Text style={styles.section}>Utilisateurs inscrits</Text>
      {contacts.map(c => <TouchableOpacity key={c.id} style={styles.person} onPress={() => {setActiveChat(c);setScreen("chat");}}>
        {c.photoURL ? <Image source={{uri:c.photoURL}} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text>👤</Text></View>}
        <View style={{flex:1}}><Text style={styles.personName}>{c.displayName || "Utilisateur IBS"}</Text><Text style={styles.muted}>{c.bio || c.email}</Text></View>
      </TouchableOpacity>)}
      <Btn title="Mon profil" onPress={() => setScreen("profile")} />
      <Btn title="Paramètres" onPress={() => setScreen("settings")} style={styles.secondary} />
    </ScrollView>}

    {screen === "chat" && <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{flex:1}} contentContainerStyle={styles.messages}>
        {messages.map(m => <View key={m.id} style={[styles.bubble, m.senderId === user.uid ? styles.mine : styles.theirs]}>
          {m.type === "audio" ? <Btn title="▶ Écouter le message vocal" onPress={() => playAudio(m.audioURL)} style={styles.audioButton} /> : <Text style={styles.body}>{m.text}</Text>}
        </View>)}
        {messages.length === 0 && <Text style={styles.muted}>Début de la conversation. Envoyez un message ou un vocal.</Text>}
      </ScrollView>
      <View style={styles.composer}>
        <TouchableOpacity style={[styles.mic, recordingNow && {backgroundColor:"#c62828"}]} onPress={recordingNow ? stopVoiceAndSend : startVoice}>
          <Text style={{fontSize:20}}>{recordingNow ? "■" : "🎤"}</Text>
        </TouchableOpacity>
        <Field placeholder={recordingNow ? "Enregistrement... appuyez sur ■ pour envoyer" : "Message"} value={message} onChangeText={setMessage} editable={!recordingNow} />
        <Btn title="➤" onPress={sendText} style={styles.sendButton} />
      </View>
      {recordingNow && <Text style={styles.recording}>Enregistrement en cours — appuyez sur ■ pour arrêter et envoyer.</Text>}
      <Btn title="← Retour aux discussions" onPress={() => {setScreen("chats");setActiveChat(null);}} style={styles.secondary} />
    </KeyboardAvoidingView>}

    {screen === "profile" && <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={choosePhoto} style={styles.photoPicker}>
        {profile.photoURL ? <Image source={{uri:profile.photoURL}} style={styles.bigAvatar} /> : <View style={styles.bigAvatarFallback}><Text style={{fontSize:36}}>📷</Text></View>}
        <Text style={styles.link}>Choisir / modifier ma photo</Text>
      </TouchableOpacity>
      <Field placeholder="Nom affiché" value={name} onChangeText={setName} />
      <Field placeholder="Bio / À propos de moi" value={bio} onChangeText={setBio} multiline />
      <Text style={styles.muted}>E-mail du compte : {user.email}</Text>
      {isCreator() && <Text style={styles.verified}>✓ Badge du fondateur</Text>}
      <Btn title="Enregistrer le profil" onPress={saveProfile} />
      <Btn title="Retour" onPress={() => setScreen("chats")} style={styles.secondary} />
    </ScrollView>}

    {screen === "settings" && <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>Compte</Text>
      <Btn title="Mon profil" onPress={() => setScreen("profile")} />
      <Btn title="Confidentialité et sécurité" onPress={() => Alert.alert("Sécurité", "La politique de confidentialité, le blocage et le signalement doivent être configurés avant une ouverture publique.")} style={styles.secondary} />
      <Text style={styles.section}>Notifications</Text>
      <Text style={styles.body}>Les notifications push nécessitent la configuration Expo Notifications et des identifiants de projet.</Text>
      <Text style={styles.section}>Stockage et données</Text>
      <Btn title={basicMode ? "Désactiver le mode basique" : "Activer le mode basique"} onPress={() => setBasicMode(v => !v)} />
      <Text style={styles.body}>Le mode basique réduit la qualité des photos choisies et limite les éléments visuels. Il ne garantit pas un coût de 0,1 Ko : les vocaux et photos nécessitent des données pour être transmis.</Text>
      <Text style={styles.section}>Outils professionnels</Text>
      <Text style={styles.body}>Catalogue, réponses rapides, messages d'accueil et d'absence sont prévus pour une prochaine étape reliée à une base de données.</Text>
      <Btn title="À propos de l'application / Mon histoire" onPress={() => setScreen("about")} />
      <Btn title="Se déconnecter" onPress={logout} style={styles.danger} />
      <Btn title="Retour" onPress={() => setScreen("chats")} style={styles.secondary} />
    </ScrollView>}

    {screen === "about" && <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>ISAAC BABYSON</Text>
      <Text style={styles.body}>Fondateur d'IBS-CHAT SOCIAL</Text>
      <Text style={styles.body}>Né à NYAMILIMA, grandi à KISEGURO.</Text>
      <Text style={styles.body}>École primaire : E.P KISEGURO Saint BENOÎT.</Text>
      <Text style={styles.body}>École secondaire : Institut KISEGURO Saint AUGUSTIN.</Text>
      <Text style={styles.body}>Famille pastorale : Papa KAYENGA et Maman MANIRIHO.</Text>
      <Text style={styles.body}>Fils aîné de trois garçons : ISAAC BABYSON, AHADI et DANIEL.</Text>
      <Text style={styles.body}>Aujourd'hui à Goma — étudiant en Biologie Médicale.</Text>
      <Text style={styles.muted}>IBS signifie Isaac BabySon.</Text>
      <Btn title="Retour aux paramètres" onPress={() => setScreen("settings")} />
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  app:{flex:1,backgroundColor:colors.bg,color:colors.text},
  center:{flex:1,justifyContent:"center",padding:22,backgroundColor:colors.bg},
  header:{padding:14,backgroundColor:colors.panel,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  brand:{fontWeight:"900",fontSize:17,color:colors.gold},
  mode:{fontSize:11,color:colors.green,fontWeight:"bold"},
  subheader:{padding:14,borderBottomWidth:1,borderBottomColor:"#26343b",flexDirection:"row",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  title:{fontSize:24,fontWeight:"900",color:colors.gold,marginBottom:14},
  subtitle:{fontSize:17,fontWeight:"bold",color:colors.text},
  verified:{color:"#64b5f6",fontWeight:"900",fontSize:12},
  content:{padding:14,gap:10,paddingBottom:40},
  input:{backgroundColor:colors.panel,color:colors.text,padding:13,borderRadius:10,minHeight:46,marginVertical:5,flex:1},
  button:{backgroundColor:colors.gold,padding:13,borderRadius:10,alignItems:"center",marginVertical:4},
  buttonText:{color:"#111",fontWeight:"800"},
  secondary:{backgroundColor:"#34434b"},
  danger:{backgroundColor:"#9b2525"},
  body:{color:colors.text,fontSize:14,lineHeight:22,marginVertical:4},
  note:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:10},
  section:{color:colors.gold,fontSize:15,fontWeight:"900",marginTop:14},
  person:{flexDirection:"row",alignItems:"center",gap:12,padding:10,borderBottomWidth:1,borderBottomColor:"#26343b"},
  avatar:{width:46,height:46,borderRadius:23},
  avatarFallback:{width:46,height:46,borderRadius:23,backgroundColor:colors.panel,alignItems:"center",justifyContent:"center"},
  personName:{color:colors.text,fontWeight:"bold"},
  muted:{color:colors.muted,fontSize:12,marginVertical:3},
  messages:{padding:12,gap:8},
  bubble:{maxWidth:"85%",padding:10,borderRadius:12},
  mine:{alignSelf:"flex-end",backgroundColor:"#005c4b"},
  theirs:{alignSelf:"flex-start",backgroundColor:colors.panel},
  composer:{flexDirection:"row",alignItems:"center",gap:6,padding:8,backgroundColor:colors.panel},
  mic:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#34434b"},
  sendButton:{paddingHorizontal:15},
  recording:{color:"#ff7777",textAlign:"center",padding:8},
  audioButton:{backgroundColor:"#34434b"},
  photoPicker:{alignItems:"center",marginBottom:10},
  bigAvatar:{width:110,height:110,borderRadius:55},
  bigAvatarFallback:{width:110,height:110,borderRadius:55,backgroundColor:colors.panel,alignItems:"center",justifyContent:"center"},
  link:{color:colors.blue,margin:10,fontWeight:"bold"}
});
