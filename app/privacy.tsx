import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPolicy() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: December 8, 2025</Text>

        <Text style={styles.heading}>Overview</Text>
        <Text style={styles.paragraph}>
          BlortNix is a simple offline puzzle game. We are committed to
          protecting your privacy and being transparent about our data
          practices.
        </Text>

        <Text style={styles.heading}>Data Collection</Text>
        <Text style={styles.paragraph}>
          BlortNix does NOT collect, store, or transmit any personal
          information. The app:
        </Text>
        <Text style={styles.bullet}>
          • Does not require an internet connection
        </Text>
        <Text style={styles.bullet}>• Does not collect personal data</Text>
        <Text style={styles.bullet}>• Does not use analytics or tracking</Text>
        <Text style={styles.bullet}>• Does not display advertisements</Text>
        <Text style={styles.bullet}>• Does not require any permissions</Text>
        <Text style={styles.bullet}>
          • Does not share data with third parties
        </Text>

        <Text style={styles.heading}>Local Data Storage</Text>
        <Text style={styles.paragraph}>
          The only data stored by BlortNix is your high score, which is saved
          locally on your device. This data never leaves your device and is not
          accessible to us or any third parties.
        </Text>

        <Text style={styles.heading}>Children&apos;s Privacy</Text>
        <Text style={styles.paragraph}>
          BlortNix is safe for users of all ages. We do not knowingly collect
          any information from children under 13 years of age or any other age
          group.
        </Text>

        <Text style={styles.heading}>Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. Any changes will
          be reflected in the &quot;Last updated&quot; date above.
        </Text>

        <Text style={styles.heading}>Contact</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this Privacy Policy, please contact us
          through the app store listing.
        </Text>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  updated: {
    color: "#666",
    fontSize: 14,
    marginBottom: 24,
  },
  heading: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  bullet: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 16,
    marginBottom: 4,
  },
  spacer: {
    height: 40,
  },
});
