import { describe, expect, it } from 'vitest';
import { feedActions, feedLinks, inAppBrowser, preferredApp } from './calendarApps';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  telegramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.0',
};

const FEED = 'https://lmsapi.mastereducation.kz/calendar/feeds/group/1-60c3b7842a0c3a3a.ics';

describe('feedLinks', () => {
  it('builds each app’s subscribe link from the https feed', () => {
    const links = feedLinks({ icsUrl: FEED, name: 'SAT Oct-26 Timur' });
    expect(links.apple).toBe('webcal://lmsapi.mastereducation.kz/calendar/feeds/group/1-60c3b7842a0c3a3a.ics');
    expect(links.google).toBe(
      'https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Flmsapi.mastereducation.kz%2Fcalendar%2Ffeeds%2Fgroup%2F1-60c3b7842a0c3a3a.ics',
    );
    expect(links.outlook).toBe(
      'https://outlook.live.com/calendar/0/addfromweb?url=https%3A%2F%2Flmsapi.mastereducation.kz%2Fcalendar%2Ffeeds%2Fgroup%2F1-60c3b7842a0c3a3a.ics&name=SAT%20Oct-26%20Timur',
    );
    expect(links.office).toBe(
      'https://outlook.office.com/calendar/0/addfromweb?url=https%3A%2F%2Flmsapi.mastereducation.kz%2Fcalendar%2Ffeeds%2Fgroup%2F1-60c3b7842a0c3a3a.ics&name=SAT%20Oct-26%20Timur',
    );
  });

  it('encodes names and URLs so nothing leaks into the query', () => {
    const links = feedLinks({ icsUrl: 'https://host/feed.ics?token=a&b=c', name: 'Группа & Co' });
    const outlook = new URL(links.outlook!);
    expect(outlook.searchParams.get('url')).toBe('https://host/feed.ics?token=a&b=c');
    expect(outlook.searchParams.get('name')).toBe('Группа & Co');
    expect(new URL(links.google!).searchParams.get('cid')).toBe('webcal://host/feed.ics?token=a&b=c');
  });

  it('uses a group’s own Google Calendar when there is one', () => {
    const googleUrl = 'https://calendar.google.com/calendar/u/0?cid=YWJj';
    expect(feedLinks({ icsUrl: FEED, name: 'G', googleUrl }).google).toBe(googleUrl);
    expect(feedLinks({ icsUrl: FEED, name: 'G', googleUrl: 'https://evil.example/x' }).google).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?cid=/);
  });

  it('builds nothing from a plain-http feed', () => {
    expect(feedLinks({ icsUrl: 'http://localhost:8000/calendar/feeds/me/t.ics', name: 'Me' }))
      .toEqual({ apple: null, google: null, outlook: null, office: null });
  });
});

describe('preferredApp', () => {
  it('picks Apple on iPhone, iPad and Mac', () => {
    expect(preferredApp({ userAgent: UA.iphone })).toBe('apple');
    expect(preferredApp({ userAgent: UA.ipad, maxTouchPoints: 5 })).toBe('apple');
    expect(preferredApp({ userAgent: UA.macChrome })).toBe('apple');
  });

  it('picks Google on Android, on Windows and anywhere else', () => {
    expect(preferredApp({ userAgent: UA.android })).toBe('google');
    expect(preferredApp({ userAgent: UA.windows })).toBe('google');
    expect(preferredApp({ userAgent: UA.linux })).toBe('google');
    expect(preferredApp({ userAgent: '' })).toBe('google');
  });
});

describe('inAppBrowser', () => {
  it('spots Telegram and Instagram, not Safari or Chrome', () => {
    expect(inAppBrowser({ userAgent: UA.telegramIos, telegramWebview: true })).toEqual({ inApp: true, appName: 'Telegram' });
    expect(inAppBrowser({ userAgent: UA.instagramAndroid })).toEqual({ inApp: true, appName: 'Instagram' });
    expect(inAppBrowser({ userAgent: UA.iphone }).inApp).toBe(false);
    expect(inAppBrowser({ userAgent: UA.android }).inApp).toBe(false);
  });
});

describe('feedActions', () => {
  const links = feedLinks({ icsUrl: FEED, name: 'G' });

  it('leads with the device’s app and offers the other three', () => {
    expect(feedActions(links, { userAgent: UA.iphone })).toEqual({ primary: 'apple', others: ['google', 'outlook', 'office'] });
    expect(feedActions(links, { userAgent: UA.android })).toEqual({ primary: 'google', others: ['apple', 'outlook', 'office'] });
    expect(feedActions(links, { userAgent: UA.windows })).toEqual({ primary: 'google', others: ['apple', 'outlook', 'office'] });
  });

  it('lets "Copy link" lead inside an in-app browser', () => {
    expect(feedActions(links, { userAgent: UA.telegramIos, telegramWebview: true })).toEqual({
      primary: null, others: ['google', 'apple', 'outlook', 'office'],
    });
  });

  it('offers only "Copy link" for a feed that isn’t https', () => {
    const none = feedLinks({ icsUrl: 'http://host/feed.ics', name: 'G' });
    expect(feedActions(none, { userAgent: UA.iphone })).toEqual({ primary: null, others: [] });
  });
});
