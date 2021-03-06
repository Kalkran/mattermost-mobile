// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {intlShape} from 'react-intl';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SectionList,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout';

import Emoji from 'app/components/emoji';
import FormattedText from 'app/components/formatted_text';
import SearchBar from 'app/components/search_bar';
import {emptyFunction} from 'app/utils/general';
import {makeStyleSheetFromTheme, changeOpacity} from 'app/utils/theme';

import EmojiPickerRow from './emoji_picker_row';

const EMOJI_SIZE = 30;
const EMOJI_GUTTER = 7.5;
const SECTION_MARGIN = 15;
const SECTION_HEADER_HEIGHT = 28;

export default class EmojiPicker extends PureComponent {
    static propTypes = {
        emojisByName: PropTypes.array.isRequired,
        emojisBySection: PropTypes.array.isRequired,
        deviceWidth: PropTypes.number.isRequired,
        isLandscape: PropTypes.bool.isRequired,
        onEmojiPress: PropTypes.func,
        theme: PropTypes.object.isRequired
    };

    static defaultProps = {
        onEmojiPress: emptyFunction
    };

    static contextTypes = {
        intl: intlShape.isRequired
    }

    constructor(props) {
        super(props);

        this.sectionListGetItemLayout = sectionListGetItemLayout({
            getItemHeight: () => {
                return EMOJI_SIZE + (EMOJI_GUTTER * 2);
            },
            getSectionHeaderHeight: () => SECTION_HEADER_HEIGHT
        });

        const emojis = this.renderableEmojis(props.emojisBySection, props.deviceWidth);
        const emojiSectionIndexByOffset = this.measureEmojiSections(emojis);

        this.state = {
            emojis,
            emojiSectionIndexByOffset,
            filteredEmojis: [],
            searchTerm: '',
            currentSectionIndex: 0
        };
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.deviceWidth !== nextProps.deviceWidth) {
            this.setState({
                emojis: this.renderableEmojis(this.props.emojisBySection, nextProps.deviceWidth)
            });
        }
    }

    renderableEmojis = (emojis, deviceWidth) => {
        const numberOfColumns = this.getNumberOfColumns(deviceWidth);

        const nextEmojis = emojis.map((section) => {
            const data = [];
            let row = {
                key: `${section.key}-0`,
                items: []
            };

            section.data.forEach((emoji, index) => {
                if (index % numberOfColumns === 0 && index !== 0) {
                    data.push(row);
                    row = {
                        key: `${section.key}-${index}`,
                        items: []
                    };
                }

                row.items.push(emoji);
            });

            if (row.items.length) {
                if (row.items.length < numberOfColumns) {
                    // push some empty items to make sure flexbox can justfiy content correctly
                    const emptyEmojis = new Array(numberOfColumns - row.items.length);
                    row.items.push(...emptyEmojis);
                }

                data.push(row);
            }

            return {
                ...section,
                data
            };
        });

        return nextEmojis;
    }

    measureEmojiSections = (emojiSections) => {
        let lastOffset = 0;
        return emojiSections.map((section) => {
            const start = lastOffset;
            const nextOffset = (section.data.length * (EMOJI_SIZE + (EMOJI_GUTTER * 2))) + SECTION_HEADER_HEIGHT;
            lastOffset += nextOffset;

            return start;
        });
    }

    changeSearchTerm = (text) => {
        this.setState({
            searchTerm: text
        });

        clearTimeout(this.searchTermTimeout);
        const timeout = text ? 100 : 0;
        this.searchTermTimeout = setTimeout(() => {
            const filteredEmojis = this.searchEmojis(text);
            this.setState({
                filteredEmojis
            });
        }, timeout);
    };

    cancelSearch = () => {
        this.setState({
            filteredEmojis: [],
            searchTerm: ''
        });
    }

    filterEmojiAliases = (aliases, searchTerm) => {
        return aliases.findIndex((alias) => alias.includes(searchTerm)) !== -1;
    }

    searchEmojis = (searchTerm) => {
        const {emojisByName} = this.props;
        const searchTermLowerCase = searchTerm.toLowerCase();

        if (!searchTerm) {
            return [];
        }

        const startsWith = [];
        const includes = [];
        emojisByName.forEach((emoji) => {
            if (emoji.startsWith(searchTermLowerCase)) {
                startsWith.push(emoji);
            } else if (emoji.includes(searchTermLowerCase)) {
                includes.push(emoji);
            }
        });

        return [...startsWith.sort(), ...includes.sort()];
    }

    getNumberOfColumns = (deviceWidth) => {
        return Math.floor(Number(((deviceWidth - (SECTION_MARGIN * 2)) / (EMOJI_SIZE + (EMOJI_GUTTER * 2)))));
    }

    renderItem = ({item}) => {
        return (
            <EmojiPickerRow
                key={item.key}
                emojiGutter={EMOJI_GUTTER}
                emojiSize={EMOJI_SIZE}
                items={item.items}
                onEmojiPress={this.props.onEmojiPress}
            />
        );
    }

    flatListKeyExtractor = (item) => item;

    flatListRenderItem = ({item}) => {
        const style = getStyleSheetFromTheme(this.props.theme);

        return (
            <TouchableOpacity
                onPress={() => this.props.onEmojiPress(item)}
                style={style.flatListRow}
            >
                <View style={style.flatListEmoji}>
                    <Emoji
                        emojiName={item}
                        size={20}
                    />
                </View>
                <Text style={style.flatListEmojiName}>{`:${item}:`}</Text>
            </TouchableOpacity>
        );
    };

    onScroll = (e) => {
        if (this.state.jumpToSection) {
            return;
        }

        clearTimeout(this.setIndexTimeout);

        const {contentOffset} = e.nativeEvent;
        let nextIndex = this.state.emojiSectionIndexByOffset.findIndex((offset) => contentOffset.y <= offset);

        if (nextIndex === -1) {
            nextIndex = this.state.emojiSectionIndexByOffset.length - 1;
        } else if (nextIndex !== 0) {
            nextIndex -= 1;
        }

        if (nextIndex !== this.state.currentSectionIndex) {
            this.setState({
                currentSectionIndex: nextIndex
            });
        }
    }

    onMomentumScrollEnd = () => {
        if (this.state.jumpToSection) {
            this.setState({
                jumpToSection: false
            });
        }
    }

    scrollToSection = (index) => {
        this.setState({
            jumpToSection: true,
            currentSectionIndex: index
        }, () => {
            this.sectionList.scrollToLocation({
                sectionIndex: index,
                itemIndex: 0,
                viewOffset: 25
            });
        });
    }

    renderSectionHeader = ({section}) => {
        const {theme} = this.props;
        const styles = getStyleSheetFromTheme(theme);

        return (
            <View
                style={styles.sectionTitleContainer}
                key={section.title}
            >
                <FormattedText
                    style={styles.sectionTitle}
                    id={section.id}
                    defaultMessage={section.defaultMessage}
                />
            </View>
        );
    }

    renderSectionIcons = () => {
        const {theme} = this.props;
        const styles = getStyleSheetFromTheme(theme);

        return this.state.emojis.map((section, index) => {
            const onPress = () => this.scrollToSection(index);

            return (
                <TouchableOpacity
                    key={section.key}
                    onPress={onPress}
                    style={styles.sectionIconContainer}
                >
                    <FontAwesomeIcon
                        name={section.icon}
                        size={17}
                        style={[styles.sectionIcon, (index === this.state.currentSectionIndex && styles.sectionIconHighlight)]}
                    />
                </TouchableOpacity>
            );
        });
    }

    sectionListKeyExtractor = (item) => item.key

    attachSectionList = (c) => {
        this.sectionList = c;
    }

    render() {
        const {deviceWidth, isLandscape, theme} = this.props;
        const {emojis, filteredEmojis, searchTerm} = this.state;
        const {intl} = this.context;
        const {formatMessage} = intl;
        const styles = getStyleSheetFromTheme(theme);

        let listComponent;
        if (searchTerm) {
            listComponent = (
                <FlatList
                    keyboardShouldPersistTaps='always'
                    style={styles.flatList}
                    data={filteredEmojis}
                    keyExtractor={this.flatListKeyExtractor}
                    renderItem={this.flatListRenderItem}
                    pageSize={10}
                    initialListSize={10}
                />
            );
        } else {
            listComponent = (
                <SectionList
                    ref={this.attachSectionList}
                    showsVerticalScrollIndicator={false}
                    style={[styles.listView, {width: deviceWidth - (SECTION_MARGIN * 2)}]}
                    sections={emojis}
                    renderSectionHeader={this.renderSectionHeader}
                    renderItem={this.renderItem}
                    keyboardShouldPersistTaps='always'
                    getItemLayout={this.sectionListGetItemLayout}
                    removeClippedSubviews={true}
                    onScroll={this.onScroll}
                    onMomentumScrollEnd={this.onMomentumScrollEnd}
                    pageSize={30}
                />
            );
        }

        let keyboardOffset = 64;
        if (Platform.OS === 'android') {
            keyboardOffset = -200;
        } else if (isLandscape) {
            keyboardOffset = 51;
        }

        return (
            <KeyboardAvoidingView
                behavior='padding'
                style={{flex: 1}}
                keyboardVerticalOffset={keyboardOffset}
            >
                <View style={styles.searchBar}>
                    <SearchBar
                        ref='search_bar'
                        placeholder={formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
                        cancelTitle={formatMessage({id: 'mobile.post.cancel', defaultMessage: 'Cancel'})}
                        backgroundColor='transparent'
                        inputHeight={33}
                        inputStyle={{
                            backgroundColor: theme.centerChannelBg,
                            color: theme.centerChannelColor,
                            fontSize: 13
                        }}
                        placeholderTextColor={changeOpacity(theme.centerChannelColor, 0.5)}
                        tintColorSearch={changeOpacity(theme.centerChannelColor, 0.8)}
                        tintColorDelete={changeOpacity(theme.centerChannelColor, 0.5)}
                        titleCancelColor={theme.centerChannelColor}
                        onChangeText={this.changeSearchTerm}
                        onCancelButtonPress={this.cancelSearch}
                        value={searchTerm}
                    />
                </View>
                <View style={styles.container}>
                    {listComponent}
                    {!searchTerm &&
                        <View style={styles.bottomContentWrapper}>
                            <View style={styles.bottomContent}>
                                {this.renderSectionIcons()}
                            </View>
                        </View>
                    }
                </View>
            </KeyboardAvoidingView>
        );
    }
}

const getStyleSheetFromTheme = makeStyleSheetFromTheme((theme) => {
    return {
        bottomContent: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.1),
            borderTopColor: changeOpacity(theme.centerChannelColor, 0.3),
            borderTopWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between'
        },
        bottomContentWrapper: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 35,
            backgroundColor: 'white'
        },
        columnStyle: {
            alignSelf: 'stretch',
            flexDirection: 'row',
            marginVertical: EMOJI_GUTTER,
            justifyContent: 'flex-start'
        },
        container: {
            alignItems: 'center',
            backgroundColor: theme.centerChannelBg,
            flex: 1
        },
        emoji: {
            width: EMOJI_SIZE,
            height: EMOJI_SIZE,
            marginHorizontal: EMOJI_GUTTER,
            alignItems: 'center',
            justifyContent: 'center'
        },
        emojiLeft: {
            marginLeft: 0
        },
        emojiRight: {
            marginRight: 0
        },
        flatList: {
            flex: 1,
            backgroundColor: theme.centerChannelBg,
            alignSelf: 'stretch'
        },
        flatListEmoji: {
            marginRight: 5
        },
        flatListEmojiName: {
            fontSize: 13,
            color: theme.centerChannelColor
        },
        flatListRow: {
            height: 40,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            backgroundColor: theme.centerChannelBg,
            borderTopWidth: 1,
            borderTopColor: changeOpacity(theme.centerChannelColor, 0.2),
            borderLeftWidth: 1,
            borderLeftColor: changeOpacity(theme.centerChannelColor, 0.2),
            borderRightWidth: 1,
            borderRightColor: changeOpacity(theme.centerChannelColor, 0.2)
        },
        listView: {
            backgroundColor: theme.centerChannelBg,
            marginBottom: 35
        },
        searchBar: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.2),
            paddingVertical: 5
        },
        section: {
            alignItems: 'center'
        },
        sectionIcon: {
            color: changeOpacity(theme.centerChannelColor, 0.3)
        },
        sectionIconContainer: {
            flex: 1,
            height: 35,
            alignItems: 'center',
            justifyContent: 'center'
        },
        sectionIconHighlight: {
            color: theme.centerChannelColor
        },
        sectionTitle: {
            color: changeOpacity(theme.centerChannelColor, 0.2),
            fontSize: 15,
            fontWeight: '700'
        },
        sectionTitleContainer: {
            height: SECTION_HEADER_HEIGHT,
            justifyContent: 'center',
            backgroundColor: theme.centerChannelBg
        },
        wrapper: {
            flex: 1
        }
    };
});
