import { Throwable, Try } from '@vzh/ts-types/fp';
import { NotificationType } from './Notification';
import BaseStore from './BaseStore';
import UIStore from './UIStore';
import Validable from './Validable';
import { JSONModel } from './JSONSerializable';

export interface ResponseLike {
  data?: any;
  status?: number;
  statusText?: string;
}

export interface ErrorResponseLike {
  config: any;
  response: ResponseLike;
}

export interface AsyncAction<T> {
  (...params: any[]): Promise<T>;
}

export function isErrorResponseLike(
  error: ErrorResponseLike | Throwable
): error is ErrorResponseLike {
  return (error as ErrorResponseLike).config !== undefined;
}

export default class RequestableStore<
  RS extends object,
  UIS extends UIStore<RS>,
  InitState extends object = {}
> extends BaseStore<RS, InitState> {
  readonly uiStore: UIS;

  constructor(rootStore: RS, uiStore: UIS, initialState?: JSONModel<InitState>) {
    super(rootStore, initialState);
    this.uiStore = uiStore;
    this.request = this.request.bind(this) as any;
    this.onRequestSuccess = this.onRequestSuccess.bind(this);
    this.onRequestError = this.onRequestError.bind(this);
  }

  // Used Try for always return successed promise but keep error if has.
  // If just use promise with error and not use catch in client code then warning in console.
  protected async request<R>(doWork: AsyncAction<R>, ...doWorkParams: any[]): Promise<Try<R>> {
    this.uiStore.cleanNotifications(NotificationType.error);
    this.uiStore.loading = true;

    try {
      const result = await doWork(...doWorkParams);
      this.onRequestSuccess(result);
      return Try.success(result);
    } catch (ex) {
      this.onRequestError(ex);
      return Try.failure(ex);
    } finally {
      this.uiStore.loading = false;
    }
  }

  protected submit<R>(
    model: Validable,
    doWork: AsyncAction<R>,
    ...doWorkParams: any[]
  ): Promise<Try<R>> {
    if (!model.validate()) {
      return Promise.resolve(Try.failure(new Error('`model` is in invalid state.')));
    }
    return this.request<R>(doWork, ...doWorkParams);
  }

  // @ts-ignore
  protected onRequestSuccess<R>(result: R): void {}

  protected getResponseErrorMessage(response: ResponseLike): string {
    return response.data || response.statusText;
  }

  protected getThrowableMessage(error: Throwable): string {
    return error.toString();
  }

  protected getErrorMessage(error: ErrorResponseLike | Throwable): string {
    return isErrorResponseLike(error) && error.response
      ? this.getResponseErrorMessage(error.response)
      : this.getThrowableMessage(error);
  }

  protected onRequestError(error: ErrorResponseLike | Throwable): void {
    console.error(error);

    this.uiStore.addNotification({
      type: NotificationType.error,
      text: this.getErrorMessage(error),
    });
  }
}