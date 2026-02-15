from abc import ABC, abstractmethod


class InteropService(ABC):
    @abstractmethod
    def lookup(self, query):
        pass

    @abstractmethod
    def verify(self, data):
        pass
