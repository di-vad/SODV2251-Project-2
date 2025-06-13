import { Alert, KeyboardAvoidingView, StyleSheet, TextInput, View, Text } from 'react-native';
import { DEFAULT_LOCATION, tryGetCurrentPosition } from '../utils/location';
import MapView, { LatLng, MapPressEvent, Marker, PoiClickEvent, Region } from 'react-native-maps';
import React, { useContext, useEffect, useState } from 'react';

import { AuthenticationContext } from '../context/AuthenticationContext';
import BigButton from '../components/BigButton';
import Spinner from 'react-native-loading-spinner-overlay';
import { StackScreenProps } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { getUserInfo as getGitHubUserInfo } from '../services/github';
import { postUser } from '../services/users';

export default function Setup({ navigation }: StackScreenProps<any>) {
    const authenticationContext = useContext(AuthenticationContext);
    const [username, setUsername] = useState('');

    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

    const [markerLocation, setMarkerLocation] = useState<LatLng>(DEFAULT_LOCATION);
    const [currentRegion, setCurrentRegion] = useState<Region>({
        ...DEFAULT_LOCATION,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
    });
    const [mapLocked, setMapLocked] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        tryGetCurrentPosition()
            .then((curPos: LatLng) => {
                setMarkerLocation(curPos);
                setCurrentRegion({ ...currentRegion, ...curPos });
            })
            .catch(() => {
                /* do nothing and keep the default location and region */
            });
    }, []);

    /**
     * Updates the marker location on the map when the user presses on the map or on a point of interest.
     * @param event The event object containing the coordinate of the press.
     */
    function handleMapPress(event: MapPressEvent | PoiClickEvent): void {
        setMarkerLocation(event.nativeEvent.coordinate);
    }

    /**
     * Handles the sign up process by getting the user's GitHub information and posting it to the server.
     * If the user does not exist on GitHub, it rejects with an error message.
     * If there is an error, it rejects with the error object.
     * If the process is successful, it sets the authentication context value and navigates to the Main screen.
     * @returns A promise that resolves when the process is successful and rejects when there is an error.
     * @throws An error if the user does not exist on GitHub or if there is an error posting the user to the server.
     */
    async function handleSignUp(): Promise<void> {
        setIsAuthenticating(true);
        getGitHubUserInfo(username)
            .catch((err) => {
                if (axios.isAxiosError(err) && err.response?.status == 404) {
                    return Promise.reject('There is no such username on GitHub. Please try again.');
                } else {
                    return Promise.reject(err);
                }
            })
            .then((fromGitHub) =>
                postUser({
                    login: fromGitHub.login,
                    avatar_url: fromGitHub.avatar_url,
                    bio: fromGitHub.bio,
                    company: fromGitHub.company,
                    name: fromGitHub.name,
                    coordinates: markerLocation,
                })
            )
            .then(() => {
                authenticationContext?.setValue(username);
                setMapLocked(false);
                navigation.replace('Main');
            })
            .catch((err) => {
                if (typeof err === 'string') {
                    setErrorMessage(err);
                } else {
                    setErrorMessage('Something went wrong. Please try again.');
                }
            })

            .finally(() => setIsAuthenticating(false));
    }

    return (
        <>
            <StatusBar style="dark" />
            <View testID="setup-screen" style={styles.container}>
                <MapView
                    onPress={handleMapPress}
                    onPoiClick={handleMapPress}
                    region={currentRegion}
                    style={styles.map}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                    showsIndoors={false}
                    mapType="mutedStandard"
                    mapPadding={{ top: 0, right: 24, bottom: 128, left: 24 }}
                >
                    <Marker coordinate={markerLocation} />
                </MapView>

                {mapLocked && <View pointerEvents="auto" style={styles.mapBlocker} />}

                <KeyboardAvoidingView style={styles.form} behavior="position">
                    <View style={styles.formOverlay}>
                        <Text style={styles.title}>Welcome to DevFinder</Text>
                        <TextInput
                            testID="input"
                            style={styles.input}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholder="Enter your GitHub username"
                            onChangeText={(text) => {
                                setUsername(text);
                                setErrorMessage(null);
                            }}
                        />
                        {errorMessage && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{errorMessage}</Text>
                            </View>
                        )}

                        <BigButton testID="button" onPress={handleSignUp} label="Sign Up" color="#031A62" />
                    </View>
                </KeyboardAvoidingView>
            </View>
            <Spinner
                visible={isAuthenticating}
                textContent="Authenticating..."
                overlayColor="#031A62BF"
                textStyle={styles.spinnerText}
            />
        </>
    );
}

const styles = StyleSheet.create({
    errorBox: {
        backgroundColor: '#fff',
        borderColor: '#cc0000',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
        width: '100%',
    },

    errorText: {
        color: '#cc0000',
        fontSize: 14,
        fontWeight: '500',
    },

    formOverlay: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        paddingVertical: 32,
        paddingHorizontal: 24,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#ddd',
    },

    title: {
        fontSize: 20,
        marginBottom: 16,
        color: '#031A62',
        fontWeight: 'bold',
    },

    mapBlocker: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: '#ffffffdd',
    },

    container: {
        flex: 1,
    },

    map: {
        ...StyleSheet.absoluteFillObject,
    },

    form: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        zIndex: 20,
    },

    spinnerText: {
        fontSize: 16,
        color: '#fff',
    },

    input: {
        backgroundColor: '#fff',
        borderColor: '#031b6233',
        borderRadius: 4,
        borderWidth: 1,
        height: 56,
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginBottom: 16,
        color: '#333',
        fontSize: 16,
    },

    error: {
        color: '#fff',
        fontSize: 12,
    },
});
